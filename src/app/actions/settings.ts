"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { formatWeekendDays } from "@/lib/company-defaults";
import { countryDefaults } from "@/lib/country";
import {
  companySettingsSchema,
  leavePolicyUpdateSchema,
  type CompanySettingsState,
  type LeavePolicyState,
} from "@/lib/settings-validation";
import { getDict, interpolate } from "@/i18n/server";
import { smtpFieldsSchema } from "@/lib/setup-validation";
import { removeLogo, saveLogo } from "@/lib/storage";

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
  revalidatePath("/hoohr/expenses");
}

// ============ SET-1: 회사 설정 ============

export async function updateCompanySettings(
  _state: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();
  const schema = companySettingsSchema({
    ...settings,
    required: common.validation.required,
  });
  const parsed = schema.safeParse({
    name: formText(formData, "name"),
    country: formText(formData, "country"),
    weekend: formData.getAll("weekend").map(String),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  // Currency and timezone are not chosen here - they are what the country
  // means. Note this also reinterprets stored amounts when the currency moves
  // (there is no FX conversion): the country is meant to be right once, at
  // install, and this exists so a mis-pick is recoverable.
  const { currency, timezone } = countryDefaults(parsed.data.country);

  await prisma.company.update({
    where: { id: admin.companyId },
    data: {
      name: parsed.data.name,
      country: parsed.data.country,
      currency,
      timezone,
      weekendDays: formatWeekendDays(new Set(parsed.data.weekend)),
    },
  });

  revalidateSettingsPages();
  return { message: settings.messages.companySaved, ok: true };
}

// ============ SET-1b: 이메일 알림 설정 ============

export async function updateMailSettings(
  _state: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();
  const parsed = z
    .object(smtpFieldsSchema(common.validation))
    .safeParse({
      smtpHost: formText(formData, "smtpHost"),
      smtpPort: formText(formData, "smtpPort"),
      smtpUser: formText(formData, "smtpUser"),
      // Empty password keeps the stored one: the form never renders the
      // secret back, so "unchanged" and "cleared" would otherwise be
      // indistinguishable. Clearing is done by clearing the host.
      smtpPass:
        typeof formData.get("smtpPass") === "string" &&
        (formData.get("smtpPass") as string).length > 0
          ? (formData.get("smtpPass") as string)
          : undefined,
      smtpFrom: formText(formData, "smtpFrom"),
      smtpSecure: formData.get("smtpSecure") || undefined,
    });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const data: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPass?: string | null;
    smtpFrom: string | null;
    smtpSecure: boolean;
  } = {
    smtpHost: parsed.data.smtpHost?.trim() || null,
    smtpPort: parsed.data.smtpPort ?? null,
    smtpUser: parsed.data.smtpUser?.trim() || null,
    smtpFrom: parsed.data.smtpFrom?.trim() || null,
    smtpSecure: parsed.data.smtpSecure === "on",
  };
  // A null host disables mail; drop the secret with it so no orphaned
  // password lingers on a disabled config.
  if (data.smtpHost) {
    if (parsed.data.smtpPass !== undefined) data.smtpPass = parsed.data.smtpPass;
  } else {
    data.smtpPass = null;
  }

  try {
    await prisma.company.update({
      where: { id: admin.companyId },
      data,
    });
  } catch {
    return { message: settings.messages.mailSaveFailed };
  }

  revalidateSettingsPages();
  return { message: settings.messages.mailSaved, ok: true };
}

// ============ SET-1c: 회사 로고 ============

export async function updateCompanyLogo(
  _state: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { message: settings.messages.logoRequired };
  }

  const saved = await saveLogo(file);
  if (!saved.ok) {
    return {
      message:
        saved.error === "TOO_LARGE"
          ? interpolate(common.validation.fileTooLarge, { max: "1MB" })
          : common.validation.fileTypeInvalid,
    };
  }

  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: admin.companyId },
      select: { logoPath: true },
    });
    await prisma.company.update({
      where: { id: admin.companyId },
      data: { logoPath: saved.storedName, logoMime: saved.mimeType },
    });
    if (company.logoPath) await removeLogo(company.logoPath);
  } catch {
    await removeLogo(saved.storedName);
    return { message: settings.messages.mailSaveFailed };
  }

  revalidateSettingsPages();
  return { message: settings.messages.logoSaved, ok: true };
}

export async function removeCompanyLogo(): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { settings } = await getDict();

  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: admin.companyId },
      select: { logoPath: true },
    });
    await prisma.company.update({
      where: { id: admin.companyId },
      data: { logoPath: null, logoMime: null },
    });
    if (company.logoPath) await removeLogo(company.logoPath);
  } catch {
    return { message: settings.messages.mailSaveFailed };
  }

  revalidateSettingsPages();
  return { message: settings.messages.logoRemoved, ok: true };
}

// ============ SET-2: 휴가 정책 ============

export async function updateLeavePolicy(
  _state: LeavePolicyState,
  formData: FormData,
): Promise<LeavePolicyState> {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();
  const schema = leavePolicyUpdateSchema({
    ...settings,
    required: common.validation.required,
  });
  const parsed = schema.safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
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
    return { message: settings.messages.policyNotFound, ok: false };
  }

  try {
    await prisma.leavePolicy.update({
      where: { id: policy.id },
      data: {
        name: parsed.data.name,
        isPaid: parsed.data.isPaid === "true",
        requiresApproval: parsed.data.requiresApproval === "true",
        active: parsed.data.active === "true",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: settings.messages.policyNameTaken, ok: false };
    }
    throw error;
  }

  revalidateSettingsPages();
  return {
    message: interpolate(settings.messages.policySaved, { name: policy.name }),
    ok: true,
  };
}