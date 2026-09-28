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
  attendanceCorrectionFormSchema,
  type AttendanceCorrectionState,
  type CheckInOutState,
  type CorrectionDecideState,
} from "@/lib/attendance-validation";
import { getDict, interpolate } from "@/i18n/server";

// ============ 출근 / 퇴근 ============

export async function checkIn(
  _state: CheckInOutState,
  _formData: FormData,
): Promise<CheckInOutState> {
  const user = await requireUser();
  const { common, attendance } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
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
    return { message: attendance.messages.checkInAlready };
  }

  revalidatePath("/hoohr/attendance");
  return { message: attendance.messages.checkInDone, ok: true };
}

export async function checkOut(
  _state: CheckInOutState,
  _formData: FormData,
): Promise<CheckInOutState> {
  const user = await requireUser();
  const { common, attendance } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
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
    return { message: attendance.messages.checkOutNotOpen };
  }

  revalidatePath("/hoohr/attendance");
  return { message: attendance.messages.checkOutDone, ok: true };
}

// ============ 근태 정정 (신청 → 매니저 승인) ============

export async function submitCorrection(
  _state: AttendanceCorrectionState,
  formData: FormData,
): Promise<AttendanceCorrectionState> {
  const user = await requireUser();
  const { common, attendance } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }

  const parsed = attendanceCorrectionFormSchema(attendance).safeParse({
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
    return { message: attendance.messages.futureDateNotAllowed };
  }

  const target = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });

  if (parsed.data.requestType !== "ADD" && !target) {
    return {
      message: interpolate(attendance.messages.noRecordForCorrection, {
        type: attendance.requestType.ADD,
      }),
    };
  }
  if (parsed.data.requestType === "ADD" && target) {
    return { message: attendance.messages.alreadyHasRecord };
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
  return { message: attendance.messages.correctionSubmitted, ok: true };
}

// ============ 근태 정정 승인/반려 (MANAGER / ADMIN) ============

export async function decideCorrection(
  _state: CorrectionDecideState,
  formData: FormData,
): Promise<CorrectionDecideState> {
  const user = await requireUser();
  const { common, attendance } = await getDict();
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return { message: common.decide.noPermission };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const unavailableMessage = common.decide.unavailable;

  if (!id) return { message: attendance.messages.invalidRequest };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { message: attendance.messages.invalidDecision };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: common.decide.rejectReasonRequired };
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
    message:
      decision === "APPROVE" ? common.decide.approveDone : common.decide.rejectDone,
    ok: true,
  };
}