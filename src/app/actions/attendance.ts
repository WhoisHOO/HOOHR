"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { getCompanyTimezone } from "@/lib/company";
import { zonedToday, parseIsoDate } from "@/lib/attendance";
import {
  approvalReviewerFromUser,
  approvalReviewerSelect,
  approvalTargetInclude,
  canReviewEmployee,
} from "@/lib/team";
import {
  AttendanceCorrectionFormSchema,
  type AttendanceCorrectionState,
  type CheckInOutState,
  type CorrectionDecideState,
} from "@/lib/attendance-validation";

// ============ 출근 / 퇴근 ============

export async function checkIn(
  _state: CheckInOutState,
  _formData: FormData,
): Promise<CheckInOutState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }
  const employeeId = user.employeeId;

  const tz = await getCompanyTimezone(user.companyId);
  const today = zonedToday(tz);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { events: { orderBy: { at: "desc" }, take: 1 } },
    });
    if (record?.events[0]?.kind === "CHECK_IN") {
      return { alreadyOpen: true as const };
    }

    const now = new Date();
    let attendanceId: string;
    if (!record) {
      const created = await tx.attendanceRecord.create({
        data: {
          companyId: user.companyId,
          employeeId,
          date: today,
          checkInAt: now,
        },
      });
      attendanceId = created.id;
    } else {
      if (!record.checkInAt) {
        await tx.attendanceRecord.update({
          where: { id: record.id },
          data: { checkInAt: now },
        });
      }
      attendanceId = record.id;
    }

    await tx.attendanceEvent.create({
      data: {
        companyId: user.companyId,
        employeeId,
        attendanceId,
        kind: "CHECK_IN",
        at: now,
      },
    });
    return { alreadyOpen: false as const };
  });

  if (result.alreadyOpen) {
    return { message: "이미 출근 상태입니다. 퇴근 후 다시 출근하실 수 있습니다." };
  }

  revalidatePath("/hoohr/attendance");
  return { message: "출근 처리되었습니다.", ok: true };
}

export async function checkOut(
  _state: CheckInOutState,
  _formData: FormData,
): Promise<CheckInOutState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }
  const employeeId = user.employeeId;

  const tz = await getCompanyTimezone(user.companyId);
  const today = zonedToday(tz);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { events: { orderBy: { at: "desc" }, take: 1 } },
    });
    if (!record || record.events[0]?.kind !== "CHECK_IN") {
      return { notOpen: true as const };
    }

    const now = new Date();
    await tx.attendanceEvent.create({
      data: {
        companyId: user.companyId,
        employeeId,
        attendanceId: record.id,
        kind: "CHECK_OUT",
        at: now,
      },
    });
    await tx.attendanceRecord.update({
      where: { id: record.id },
      data: { checkOutAt: now },
    });
    return { notOpen: false as const };
  });

  if (result.notOpen) {
    return { message: "출근 상태가 아닙니다. 먼저 출근해주세요." };
  }

  revalidatePath("/hoohr/attendance");
  return { message: "퇴근 처리되었습니다.", ok: true };
}

// ============ 근태 정정 (신청 → 매니저 승인) ============

export async function submitCorrection(
  _state: AttendanceCorrectionState,
  formData: FormData,
): Promise<AttendanceCorrectionState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }

  const parsed = AttendanceCorrectionFormSchema.safeParse({
    date: formData.get("date"),
    requestType: formData.get("requestType"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const tz = await getCompanyTimezone(user.companyId);
  const today = zonedToday(tz);
  const date = parseIsoDate(parsed.data.date);
  if (date.getTime() > today.getTime()) {
    return { message: "미래 날짜로는 정정을 신청할 수 없습니다." };
  }

  const target = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });

  if (parsed.data.requestType !== "ADD" && !target) {
    return { message: "해당 날짜의 출근 기록이 없습니다. '기록 누락' 유형을 이용하세요." };
  }
  if (parsed.data.requestType === "ADD" && target) {
    return { message: "해당 날짜에 이미 출근 기록이 있습니다." };
  }

  await prisma.attendanceCorrection.create({
    data: {
      companyId: user.companyId,
      employeeId: user.employeeId,
      attendanceId: target?.id,
      date,
      requestType: parsed.data.requestType,
      note: parsed.data.note,
    },
  });

  revalidatePath("/hoohr/attendance");
  return { message: "정정 요청이 접수되었습니다.", ok: true };
}

// ============ 근태 정정 승인/반려 (MANAGER / ADMIN) ============

export async function decideCorrection(
  _state: CorrectionDecideState,
  formData: FormData,
): Promise<CorrectionDecideState> {
  const user = await requireUser();
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return { message: "승인 권한이 없습니다." };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const unavailableMessage = "요청을 처리할 수 없습니다. 최신 목록을 확인해주세요.";

  if (!id) return { message: "요청 정보가 올바르지 않습니다." };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { message: "결정 값이 올바르지 않습니다." };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: "반려 시 사유를 입력해주세요." };
  }

  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id, companyId: user.companyId, status: "PENDING" },
    include: approvalTargetInclude,
  });
  if (!correction || !canReviewEmployee(user, correction)) {
    return { message: unavailableMessage };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reviewer = await tx.user.findFirst({
      where: { id: user.id, companyId: user.companyId, isActive: true },
      select: approvalReviewerSelect,
    });
    if (!reviewer) return false;

    const fresh = await tx.attendanceCorrection.findFirst({
      where: { id, companyId: user.companyId, status: "PENDING" },
      include: approvalTargetInclude,
    });
    if (!fresh || !canReviewEmployee(approvalReviewerFromUser(reviewer), fresh)) {
      return false;
    }

    const result = await tx.attendanceCorrection.updateMany({
      where: {
        id,
        companyId: user.companyId,
        status: "PENDING",
        employee: { companyId: user.companyId },
      },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedById: reviewer.id,
        decidedAt: new Date(),
        comment: comment || null,
      },
    });
    return result.count === 1;
  });

  if (!updated) return { message: unavailableMessage };

  revalidatePath("/hoohr/attendance");
  return {
    message: decision === "APPROVE" ? "승인 처리되었습니다." : "반려 처리되었습니다.",
    ok: true,
  };
}