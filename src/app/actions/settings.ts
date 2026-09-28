"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { parseIsoDate, zonedToday } from "@/lib/attendance";
import { getCompanyTimezone } from "@/lib/company";
import {
  CompanySettingsSchema,
  ExpenseCategoryCreateSchema,
  ExpenseCategoryDeleteSchema,
  ExpenseCategoryUpdateSchema,
  HolidayCreateSchema,
  HolidayDeleteSchema,
  LeavePolicyIdSchema,
  LeavePolicyUpdateSchema,
  type CompanySettingsState,
  type ExpenseCategoryState,
  type HolidayState,
  type LeavePolicyState,
} from "@/lib/settings-validation";

type AdminContext = { companyId: string };

function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function formCheckbox(formData: FormData, key: string): string {
  const value = formData.get(key);
  return value === "on" || value === "true" ? "true" : "false";
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/** 관리자 설정 변경 후 재검증 대상 (표시·계산에 반영되는 화면). */
function revalidateSettingsPages(): void {
  revalidatePath("/hoohr/admin/settings");
  revalidatePath("/hoohr");
  revalidatePath("/hoohr/leave");
  revalidatePath("/hoohr/attendance");
  revalidatePath("/hoohr/expenses");
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// ============ SET-1: 회사 설정 ============

export async function updateCompanySettings(
  _state: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const parsed = CompanySettingsSchema.safeParse({
    name: formText(formData, "name"),
    timezone: formText(formData, "timezone"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  if (!isValidTimezone(parsed.data.timezone)) {
    return { fieldErrors: { timezone: ["알 수 없는 시간대입니다."] } };
  }

  await prisma.company.update({
    where: { id: admin.companyId },
    data: { name: parsed.data.name, timezone: parsed.data.timezone },
  });

  revalidateSettingsPages();
  return { message: "회사 설정이 저장되었습니다.", ok: true };
}

// ============ SET-2: 휴가 정책 ============

export async function updateLeavePolicy(
  _state: LeavePolicyState,
  formData: FormData,
): Promise<LeavePolicyState> {
  const admin = await requireAdmin();
  const parsed = LeavePolicyUpdateSchema.safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
    annualDays: formData.get("annualDays"),
    maxCarryOverDays: formData.get("maxCarryOverDays"),
    isPaid: formCheckbox(formData, "isPaid"),
    requiresApproval: formCheckbox(formData, "requiresApproval"),
    active: formCheckbox(formData, "active"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const policy = await prisma.leavePolicy.findFirst({
    where: { id: parsed.data.id, companyId: admin.companyId },
    select: { id: true, name: true },
  });
  if (!policy) {
    return { message: "휴가 정책을 찾을 수 없습니다.", ok: false };
  }

  try {
    await prisma.leavePolicy.update({
      where: { id: policy.id },
      data: {
        name: parsed.data.name,
        annualDays: parsed.data.annualDays,
        maxCarryOverDays: parsed.data.maxCarryOverDays,
        isPaid: parsed.data.isPaid === "true",
        requiresApproval: parsed.data.requiresApproval === "true",
        active: parsed.data.active === "true",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "같은 이름의 휴가 정책이 이미 있습니다.", ok: false };
    }
    throw error;
  }

  revalidateSettingsPages();
  return { message: `휴가 정책이 저장되었습니다. (${policy.name})`, ok: true };
}

/**
 * 정책의 연간 부여 일수를 올해 잔액에 반영 (ADMIN 전용 명시적 실행).
 * 기존 잔액 행만 갱신하며, 사용일(usedDays)·조정일(adjustDays)은 건드리지 않는다.
 */
export async function applyPolicyToCurrentYear(
  _state: LeavePolicyState,
  formData: FormData,
): Promise<LeavePolicyState> {
  const admin = await requireAdmin();
  const parsed = LeavePolicyIdSchema.safeParse({ id: formText(formData, "id") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const policy = await prisma.leavePolicy.findFirst({
    where: { id: parsed.data.id, companyId: admin.companyId },
    select: { id: true, name: true, annualDays: true },
  });
  if (!policy) {
    return { message: "휴가 정책을 찾을 수 없습니다.", ok: false };
  }

  const year = await getCompanyYear(admin);
  const result = await prisma.leaveBalance.updateMany({
    where: { policyId: policy.id, year },
    data: { grantedDays: policy.annualDays },
  });

  revalidateSettingsPages();
  return {
    message:
      result.count === 0
        ? `${year}년 잔액 행이 없어 반영하지 않았습니다. (CSV 임포트 또는 정책 적용 대상 없음)`
        : `${year}년 잔액 ${result.count}건에 ${policy.annualDays}일을 부여했습니다.`,
    ok: true,
  };
}

async function getCompanyYear(admin: AdminContext): Promise<number> {
  const timezone = await getCompanyTimezone(admin.companyId);
  return zonedToday(timezone).getUTCFullYear();
}

// ============ SET-3: 공휴일 ============

export async function createHoliday(
  _state: HolidayState,
  formData: FormData,
): Promise<HolidayState> {
  const admin = await requireAdmin();
  const parsed = HolidayCreateSchema.safeParse({
    date: formText(formData, "date"),
    name: formText(formData, "name"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const date = parseIsoDate(parsed.data.date);
  try {
    await prisma.holiday.create({
      data: { companyId: admin.companyId, date, name: parsed.data.name },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "이미 등록된 공휴일입니다.", ok: false };
    }
    throw error;
  }

  revalidateSettingsPages();
  return { message: "공휴일이 등록되었습니다.", ok: true };
}

export async function deleteHoliday(
  _state: HolidayState,
  formData: FormData,
): Promise<HolidayState> {
  const admin = await requireAdmin();
  const parsed = HolidayDeleteSchema.safeParse({ id: formText(formData, "id") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const result = await prisma.holiday.deleteMany({
    where: { id: parsed.data.id, companyId: admin.companyId },
  });
  if (result.count === 0) {
    return { message: "공휴일을 찾을 수 없습니다.", ok: false };
  }

  revalidateSettingsPages();
  return { message: "공휴일이 삭제되었습니다.", ok: true };
}

// ============ SET-4: 경비 분류 ============

export async function createExpenseCategory(
  _state: ExpenseCategoryState,
  formData: FormData,
): Promise<ExpenseCategoryState> {
  const admin = await requireAdmin();
  const parsed = ExpenseCategoryCreateSchema.safeParse({
    name: formText(formData, "name"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  try {
    await prisma.expenseCategory.create({
      data: { companyId: admin.companyId, name: parsed.data.name },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "이미 존재하는 분류명입니다.", ok: false };
    }
    throw error;
  }

  revalidateSettingsPages();
  return { message: "경비 분류가 추가되었습니다.", ok: true };
}

export async function updateExpenseCategory(
  _state: ExpenseCategoryState,
  formData: FormData,
): Promise<ExpenseCategoryState> {
  const admin = await requireAdmin();
  const parsed = ExpenseCategoryUpdateSchema.safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
    active: formCheckbox(formData, "active"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: parsed.data.id, companyId: admin.companyId },
    select: { id: true },
  });
  if (!category) {
    return { message: "분류를 찾을 수 없습니다.", ok: false };
  }

  try {
    await prisma.expenseCategory.update({
      where: { id: category.id },
      data: { name: parsed.data.name, active: parsed.data.active === "true" },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "이미 존재하는 분류명입니다.", ok: false };
    }
    throw error;
  }

  revalidateSettingsPages();
  return { message: "경비 분류가 저장되었습니다.", ok: true };
}

/** 사용 중인 분류(항목이 존재)는 삭제하지 않고 비활성화만 허용. */
export async function deleteExpenseCategory(
  _state: ExpenseCategoryState,
  formData: FormData,
): Promise<ExpenseCategoryState> {
  const admin = await requireAdmin();
  const parsed = ExpenseCategoryDeleteSchema.safeParse({ id: formText(formData, "id") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.expenseCategory.findFirst({
      where: { id: parsed.data.id, companyId: admin.companyId },
      select: { id: true, name: true, _count: { select: { items: true } } },
    });
    if (!category) return { kind: "not_found" as const, name: "" };
    if (category._count.items > 0) {
      return { kind: "in_use" as const, name: category.name };
    }

    await tx.expenseCategory.delete({ where: { id: category.id } });
    return { kind: "deleted" as const, name: category.name };
  });

  if (result.kind === "not_found") {
    return { message: "분류를 찾을 수 없습니다.", ok: false };
  }
  if (result.kind === "in_use") {
    return {
      message: `사용 중인 분류(${result.name})는 삭제할 수 없습니다. 비활성화하세요.`,
      ok: false,
    };
  }

  revalidateSettingsPages();
  return { message: "경비 분류가 삭제되었습니다.", ok: true };
}
