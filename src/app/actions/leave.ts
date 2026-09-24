"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { getCompanyTimezone } from "@/lib/company";
import { parseIsoDate, zonedToday } from "@/lib/attendance";
import { computeLeaveDays, remainingDays } from "@/lib/leave";
import {
  LeaveRequestFormSchema,
  type BalanceImportState,
  type LeaveCancelState,
  type LeaveDecideState,
  type LeaveRequestState,
} from "@/lib/leave-validation";

// ============ 휴가 신청 (EMPLOYEE) ============

export async function requestLeave(
  _state: LeaveRequestState,
  formData: FormData,
): Promise<LeaveRequestState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }

  const parsed = LeaveRequestFormSchema.safeParse({
    policyId: formData.get("policyId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isHalfDay: String(formData.get("isHalfDay") ?? ""),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const isHalfDay = ["true", "1", "on"].includes(parsed.data.isHalfDay ?? "");
  const start = parseIsoDate(parsed.data.startDate);
  const end = parseIsoDate(parsed.data.endDate);

  const tz = await getCompanyTimezone(user.companyId);
  const today = zonedToday(tz);
  if (start.getTime() < today.getTime()) {
    return { message: "과거 날짜로는 휴가를 신청할 수 없습니다." };
  }
  if (start.getTime() > end.getTime()) {
    return { message: "종료일은 시작일보다 빠를 수 없습니다." };
  }
  if (isHalfDay && start.getTime() !== end.getTime()) {
    return { message: "반차는 하루만 신청할 수 있습니다." };
  }

  const policy = await prisma.leavePolicy.findFirst({
    where: { companyId: user.companyId, id: parsed.data.policyId, active: true },
  });
  if (!policy) {
    return { message: "선택한 휴가 유형(정책)이 존재하지 않습니다." };
  }

  const days = computeLeaveDays(start, end, isHalfDay);
  if (days <= 0) {
    return { message: "선택 기간에 근무일이 없습니다 (주말만 선택됨)." };
  }

  if (policy.kind !== "UNPAID") {
    const year = start.getUTCFullYear();
    const bal = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_policyId_year: {
          employeeId: user.employeeId,
          policyId: policy.id,
          year,
        },
      },
    });
    const available = bal ? remainingDays(bal) : 0;
    if (days > available) {
      return {
        message: `${policy.name} 잔여가 부족합니다 (잔여 ${available}일 / 신청 ${days}일).`,
      };
    }
  }

  await prisma.leaveRequest.create({
    data: {
      companyId: user.companyId,
      employeeId: user.employeeId,
      policyId: policy.id,
      startDate: start,
      endDate: end,
      isHalfDay,
      halfDayDate: isHalfDay ? start : null,
      days,
      reason: parsed.data.reason?.trim() || null,
    },
  });

  revalidatePath("/app/leave");
  return { message: "휴가 신청이 접수되었습니다.", ok: true };
}

// ============ 휴가 승인/반려 (MANAGER / ADMIN) ============

export async function decideLeave(
  _state: LeaveDecideState,
  formData: FormData,
): Promise<LeaveDecideState> {
  const user = await requireUser();
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return { message: "승인 권한이 없습니다." };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!id) return { message: "요청 정보가 올바르지 않습니다." };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { message: "결정 값이 올바르지 않습니다." };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: "반려 시 사유를 입력해주세요." };
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { policy: true, employee: true },
  });
  if (!leave || leave.status !== "PENDING") {
    return { message: "이미 처리된 요청입니다." };
  }

  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    // 상태 재확인 후 승인/반려 (동시 처리 방지)
    const fresh = await tx.leaveRequest.findUnique({ where: { id } });
    if (!fresh || fresh.status !== "PENDING") return;

    if (status === "APPROVED" && leave.policy.kind !== "UNPAID") {
      const year = fresh.startDate.getUTCFullYear();
      await tx.leaveBalance.update({
        where: {
          employeeId_policyId_year: {
            employeeId: fresh.employeeId,
            policyId: fresh.policyId,
            year,
          },
        },
        data: { usedDays: { increment: fresh.days } },
      });
    }

    await tx.leaveRequest.update({
      where: { id },
      data: {
        status,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionComment: comment || null,
      },
    });
  });

  revalidatePath("/app/leave");
  revalidatePath("/app");
  return {
    message: decision === "APPROVE" ? "승인 처리되었습니다." : "반려 처리되었습니다.",
    ok: true,
  };
}

// ============ 휴가 신청 취소 (본인, 승인 전만) ============

export async function cancelLeave(
  _state: LeaveCancelState,
  formData: FormData,
): Promise<LeaveCancelState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }
  const employeeId = user.employeeId;
  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "요청 정보가 올바르지 않습니다." };

  const leave = await prisma.leaveRequest.findFirst({
    where: { id, employeeId, status: "PENDING" },
  });
  if (!leave) {
    return { message: "취소할 수 없는 요청입니다 (승인 이후에는 취소 불가)." };
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELED" },
  });

  revalidatePath("/app/leave");
  return { message: "휴가 신청이 취소되었습니다.", ok: true };
}

// ============ 연차 잔여 CSV 가져오기 (ADMIN) ============

const BalanceRowSchema = z.object({
  email: z.string().trim().email({ error: "이메일 형식 오류" }),
  kind: z.enum(["PTO", "SICK", "UNPAID"]),
  year: z.coerce.number().int().min(2000).max(2100),
  grantedDays: z.coerce.number().min(0).max(1000),
  usedDays: z.coerce.number().min(0).max(1000).default(0),
  adjustDays: z.coerce.number().min(-1000).max(1000).default(0),
});

export async function importBalances(
  _state: BalanceImportState,
  formData: FormData,
): Promise<BalanceImportState> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { message: "CSV 파일을 선택해주세요." };
  }
  if (file.size === 0) {
    return { message: "파일이 비어 있습니다." };
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { message: "파일에 내용이 없습니다." };
  }
  if (lines[0].toLowerCase().startsWith("email")) {
    lines.shift(); // 헤더 제거
  }

  const policies = await prisma.leavePolicy.findMany({
    where: { companyId: admin.companyId },
    select: { id: true, kind: true },
  });
  const policyByKind = new Map(
    policies.map((p) => [p.kind, p.id] as const),
  );

  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const lineNo = i + 1;
    const parsed = BalanceRowSchema.safeParse({
      email: cols[0],
      kind: cols[1],
      year: cols[2],
      grantedDays: cols[3],
      usedDays: cols[4] ?? "0",
      adjustDays: cols[5] ?? "0",
    });
    if (!parsed.success || cols.length < 4) {
      errors.push(`line ${lineNo}: 형식 오류 (email,kind,year,grantedDays[,usedDays,adjustDays])`);
      continue;
    }
    const { email, kind, year, grantedDays, usedDays, adjustDays } = parsed.data;
    const policyId = policyByKind.get(kind);
    if (!policyId) {
      errors.push(`line ${lineNo}: 정책 없음 (${kind})`);
      continue;
    }
    const employee = await prisma.employee.findFirst({
      where: { companyId: admin.companyId, email },
      select: { id: true },
    });
    if (!employee) {
      errors.push(`line ${lineNo}: 직원 없음 (${email})`);
      continue;
    }

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_policyId_year: {
          employeeId: employee.id,
          policyId,
          year,
        },
      },
      update: { grantedDays, usedDays, adjustDays },
      create: {
        employeeId: employee.id,
        policyId,
        year,
        grantedDays,
        usedDays,
        adjustDays,
      },
    });
    imported += 1;
  }

  revalidatePath("/app/admin/balances");
  revalidatePath("/app/leave");
  return {
    message: `${imported}건 가져왔습니다${errors.length > 0 ? `, 오류 ${errors.length}건 (예: ${errors[0]})` : ""}.`,
    ok: errors.length === 0,
  };
}