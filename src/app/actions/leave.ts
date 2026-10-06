"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { getCompanyTimezone, getCompanyWeekend } from "@/lib/company";
import { parseIsoDate, zonedToday } from "@/lib/date";
import { computeLeaveDays } from "@/lib/leave";
import { isWorkday } from "@/lib/holidays";
import { getCompanyHolidayName, getCompanyHolidays } from "@/lib/holiday-store";
import {
  approvalReviewerFromUser,
  approvalReviewerSelect,
  approvalTargetInclude,
  canReviewEmployee,
} from "@/lib/team";
import {
  balanceRowSchema,
  leaveRequestFormSchema,
  type BalanceImportState,
  type LeaveCancelState,
  type LeaveDecideState,
  type LeaveRequestState,
} from "@/lib/leave-validation";
import { getDict, interpolate } from "@/i18n/server";
import { notifyLeaveDecision, type LeaveDecisionOutcome } from "@/lib/notifications";

/** The slice of a decided request the NOT-1 notice needs, captured in-transaction. */
type LeaveDecisionMail = {
  to: string;
  requesterName: string;
  kind: "PTO" | "SICK" | "UNPAID";
  startDate: Date;
  endDate: Date;
  days: number;
};

// ============ 휴가 신청 (EMPLOYEE) ============

export async function requestLeave(
  _state: LeaveRequestState,
  formData: FormData,
): Promise<LeaveRequestState> {
  const user = await requireUser();
  const { common, leave } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }

  const parsed = leaveRequestFormSchema(leave).safeParse({
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
    return { message: leave.messages.pastDatesNotAllowed };
  }
  if (start.getTime() > end.getTime()) {
    return { message: leave.messages.endBeforeStart };
  }
  if (isHalfDay && start.getTime() !== end.getTime()) {
    return { message: leave.messages.halfDaySingleDayOnly };
  }

  const policy = await prisma.leavePolicy.findFirst({
    where: { companyId: user.companyId, id: parsed.data.policyId, active: true },
  });
  if (!policy) {
    return { message: leave.messages.policyNotFound };
  }

  const holidays = await getCompanyHolidays(user.companyId);
  const weekend = await getCompanyWeekend(user.companyId);
  const days = computeLeaveDays(start, end, isHalfDay, holidays, weekend);
  if (days <= 0) {
    return { message: leave.messages.noWorkdays };
  }
  if (isHalfDay && !isWorkday(start, holidays, weekend)) {
    const name = await getCompanyHolidayName(user.companyId, start);
    return {
      message: name
        ? interpolate(leave.messages.halfDayOnHoliday, {
            name,
            m: start.getUTCMonth() + 1,
            d: start.getUTCDate(),
          })
        : interpolate(leave.messages.halfDayOnWeekend, {
            m: start.getUTCMonth() + 1,
            d: start.getUTCDate(),
          }),
    };
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

  revalidatePath("/hoohr/leave");
  return { message: leave.messages.requestSubmitted, ok: true };
}

// ============ 휴가 승인/반려 (MANAGER / ADMIN) ============

export async function decideLeave(
  _state: LeaveDecideState,
  formData: FormData,
): Promise<LeaveDecideState> {
  const user = await requireUser();
  const { common, leave } = await getDict();
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return { message: common.decide.noPermission };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const unavailableMessage = common.decide.unavailable;

  if (!id) return { message: leave.messages.invalidRequest };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { message: leave.messages.invalidDecision };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: common.decide.rejectReasonRequired };
  }

  const request = await prisma.leaveRequest.findFirst({
    where: { id, companyId: user.companyId, status: "PENDING" },
    include: { policy: true, ...approvalTargetInclude },
  });
  if (
    !request ||
    request.policy.companyId !== user.companyId ||
    !canReviewEmployee(user, request)
  ) {
    return { message: unavailableMessage };
  }

  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  // The payload is built from the row the transaction actually updated, not
  // from the read above it: the two reads race, and a decision notice that
  // describes a different row than the one approved is worse than no notice.
  let decided: LeaveDecisionMail | null = null;

  try {
    decided = await prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findFirst({
        where: { id: user.id, companyId: user.companyId, isActive: true },
        select: approvalReviewerSelect,
      });
      if (!reviewer) return null;

      const fresh = await tx.leaveRequest.findFirst({
        where: { id, companyId: user.companyId, status: "PENDING" },
        include: { policy: true, ...approvalTargetInclude },
      });
      if (
        !fresh ||
        fresh.policy.companyId !== user.companyId ||
        !canReviewEmployee(approvalReviewerFromUser(reviewer), fresh)
      ) {
        return null;
      }

      const result = await tx.leaveRequest.updateMany({
        where: {
          id,
          companyId: user.companyId,
          status: "PENDING",
          employee: { companyId: user.companyId },
        },
        data: {
          status,
          decidedById: reviewer.id,
          decidedAt: new Date(),
          decisionComment: comment || null,
        },
      });
      if (result.count !== 1) return null;

      if (status === "APPROVED" && fresh.policy.kind !== "UNPAID") {
        await tx.leaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: fresh.employeeId,
              policyId: fresh.policyId,
              year: fresh.startDate.getUTCFullYear(),
            },
          },
          update: { usedDays: { increment: fresh.days } },
          create: {
            employeeId: fresh.employeeId,
            policyId: fresh.policyId,
            year: fresh.startDate.getUTCFullYear(),
            grantedDays: 0,
            usedDays: fresh.days,
            adjustDays: 0,
          },
        });
      }

      return {
        to: fresh.employee.email,
        requesterName: fresh.employee.name,
        kind: fresh.policy.kind,
        startDate: fresh.startDate,
        endDate: fresh.endDate,
        days: fresh.days,
      };
    });
  } catch {
    return { message: unavailableMessage };
  }

  if (!decided) return { message: unavailableMessage };

  // NOT-1. Awaited on purpose: an unawaited send can be dropped once the
  // response is flushed, and a silently lost decision notice is exactly the
  // quiet-failure class this codebase has been bitten by before. It is safe to
  // await because `notifyLeaveDecision` cannot throw and the decision is
  // already committed, so the worst case is a slower response, not a wrong one.
  await notifyLeaveDecision({
    ...decided,
    reviewerName: user.name,
    decision: status as LeaveDecisionOutcome,
    comment,
  });

  revalidatePath("/hoohr/leave");
  revalidatePath("/hoohr");
  return {
    message:
      decision === "APPROVE" ? common.decide.approveDone : common.decide.rejectDone,
    ok: true,
  };
}

// ============ 휴가 신청 취소 (본인, 승인 전만) ============

export async function cancelLeave(
  _state: LeaveCancelState,
  formData: FormData,
): Promise<LeaveCancelState> {
  const user = await requireUser();
  const { common, leave } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }
  const employeeId = user.employeeId;
  const id = String(formData.get("id") ?? "");
  if (!id) return { message: leave.messages.invalidRequest };

  const request = await prisma.leaveRequest.findFirst({
    where: { id, employeeId, status: "PENDING" },
  });
  if (!request) {
    return { message: leave.messages.cannotCancel };
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELED" },
  });

  revalidatePath("/hoohr/leave");
  return { message: leave.messages.cancelDone, ok: true };
}

// ============ 연차 잔여 CSV 가져오기 (ADMIN) ============

export async function importBalances(
  _state: BalanceImportState,
  formData: FormData,
): Promise<BalanceImportState> {
  const admin = await requireAdmin();
  const { leave } = await getDict();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { message: leave.balanceImport.csvRequired };
  }
  if (file.size === 0) {
    return { message: leave.balanceImport.fileEmpty };
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { message: leave.balanceImport.fileNoContent };
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
    const parsed = balanceRowSchema(leave).safeParse({
      email: cols[0],
      kind: cols[1],
      year: cols[2],
      grantedDays: cols[3],
      usedDays: cols[4] ?? "0",
      adjustDays: cols[5] ?? "0",
    });
    if (!parsed.success || cols.length < 4) {
      errors.push(
        interpolate(leave.balanceImport.lineFormatError, { line: lineNo }),
      );
      continue;
    }
    const { email, kind, year, grantedDays, usedDays, adjustDays } = parsed.data;
    const policyId = policyByKind.get(kind);
    if (!policyId) {
      errors.push(
        interpolate(leave.balanceImport.lineNoPolicy, { line: lineNo, kind }),
      );
      continue;
    }
    const employee = await prisma.employee.findFirst({
      where: { companyId: admin.companyId, email },
      select: { id: true },
    });
    if (!employee) {
      errors.push(
        interpolate(leave.balanceImport.lineNoEmployee, { line: lineNo, email }),
      );
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

  revalidatePath("/hoohr/admin/balances");
  revalidatePath("/hoohr/leave");
  const message =
    errors.length > 0
      ? interpolate(leave.balanceImport.importedWithErrors, {
          count: imported,
          errors: errors.length,
          example: errors[0],
        })
      : interpolate(leave.balanceImport.imported, { count: imported });
  return {
    message,
    ok: errors.length === 0,
  };
}