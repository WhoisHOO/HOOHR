"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { formatWeekendDays } from "@/lib/company-defaults";
import {
  companyNoticeSchema,
  companySettingsSchema,
  leavePolicyUpdateSchema,
  type CompanySettingsState,
  type LeavePolicyState,
} from "@/lib/settings-validation";
import { getDict, interpolate } from "@/i18n/server";
import { smtpFieldsSchema } from "@/lib/setup-validation";
import { sendCompanyMail } from "@/lib/notifications";
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
    weekend: formData.getAll("weekend").map(String),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  await prisma.company.update({
    where: { id: admin.companyId },
    data: {
      name: parsed.data.name,
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

// ============ SET-1b-2: 테스트 메일 ============

export async function sendTestMail(): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { settings } = await getDict();

  const result = await sendCompanyMail(admin.companyId, {
    to: admin.email,
    subject: settings.sections.mail.testSubject,
    text: settings.sections.mail.testBody,
    html: `<p>${settings.sections.mail.testBody}</p>`,
  });
  if (result.sent) {
    return { message: settings.messages.testMailSent, ok: true };
  }
  return { message: settings.messages.testMailFailed };
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

// ============ SET-1e: 외부 접속 확인 ============

export async function checkPublicAccess(): Promise<CompanySettingsState> {
  await requireAdmin();
  const { settings } = await getDict();
  const raw = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (!raw || /localhost|127\.0\.0\.1/.test(raw)) {
    return { message: settings.sections.external.none };
  }

  // Server-side probe of the public address, same check start-tunnel runs.
  // Short timeout so a dead tunnel degrades to a message, not a stuck form.
  try {
    const res = await fetch(`${raw}/api/health`, {
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    if (res.status === 200) {
      return { message: settings.sections.external.reachable, ok: true };
    }
    return { message: settings.sections.external.unreachable };
  } catch {
    return { message: settings.sections.external.unreachable };
  }
}

// ============ SET-1d: 공지사항 ============

export async function updateCompanyNotice(
  _state: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();
  const parsed = companyNoticeSchema({
    ...settings,
    required: common.validation.required,
  }).safeParse({
    notice: formText(formData, "notice"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  // Empty clears the notice: the dashboard hides a null/empty notice.
  const notice = parsed.data.notice?.trim() || null;
  try {
    await prisma.company.update({
      where: { id: admin.companyId },
      data: { notice },
    });
  } catch {
    return { message: settings.messages.mailSaveFailed };
  }

  revalidateSettingsPages();
  return { message: settings.messages.noticeSaved, ok: true };
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