"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { getCompanyTimezone, getCompanyWeekend } from "@/lib/company";
import { parseIsoDate, zonedToday } from "@/lib/date";
import { computeLeaveDays } from "@/lib/leave";
import { isWorkday } from "@/lib/weekend";
import {
  leaveRequestFormSchema,
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

  const weekend = await getCompanyWeekend(user.companyId);
  const days = computeLeaveDays(start, end, isHalfDay, weekend);
  if (days <= 0) {
    return { message: leave.messages.noWorkdays };
  }
  if (isHalfDay && !isWorkday(start, weekend)) {
    return {
      message: interpolate(leave.messages.halfDayOnWeekend, {
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
  if (user.role !== "ADMIN") {
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
    include: { policy: true, employee: { select: { id: true, companyId: true, name: true, email: true } } },
  });
  if (
    !request ||
    request.policy.companyId !== user.companyId ||
    request.employeeId === user.employeeId
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
        select: { id: true },
      });
      if (!reviewer) return null;

      const fresh = await tx.leaveRequest.findFirst({
        where: { id, companyId: user.companyId, status: "PENDING" },
        include: { policy: true, employee: { select: { id: true, companyId: true, name: true, email: true } } },
      });
      if (
        !fresh ||
        fresh.policy.companyId !== user.companyId ||
        fresh.employeeId === user.employeeId
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

