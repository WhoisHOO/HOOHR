import { z } from "zod";
import { interpolate } from "@/i18n/format";
import type { commonKo } from "@/i18n/dictionaries/common";
import type { FieldErrors } from "@/lib/auth-validation";

export type SetupState =
  | {
      fieldErrors?: FieldErrors;
      message?: string;
    }
  | undefined;

/**
 * The notification-mail fields, shared by the setup wizard and the Company
 * settings screen so both validate identically. Everything is optional: an
 * empty host disables mail, exactly like an unset SMTP_HOST.
 */
export function smtpFieldsSchema(v: typeof commonKo.validation) {
  const optionalEmail = z
    .string()
    .trim()
    .optional()
    .refine((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), {
      error: v.emailInvalid,
    });
  return {
    smtpHost: z
      .string()
      .trim()
      .optional()
      .refine((s) => !s || /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s), {
        error: v.hostInvalid,
      }),
    smtpPort: z.preprocess(
      (s) => (s === "" || s === undefined || s === null ? undefined : s),
      z.coerce
        .number({ error: v.portInvalid })
        .int({ error: v.portInvalid })
        .min(1, { error: v.portInvalid })
        .max(65535, { error: v.portInvalid })
        .optional(),
    ),
    smtpUser: z.string().trim().optional(),
    smtpPass: z.string().optional(),
    smtpFrom: optionalEmail,
    smtpSecure: z.enum(["on"]).optional(),
  };
}

export function setupFormSchema(v: typeof commonKo.validation) {
  return z.object({
    companyName: z.string().trim().min(1, { error: v.nameMin ? interpolate(v.nameMin, { min: 1 }) : "Required" }),
    name: z.string().trim().min(2, { error: interpolate(v.nameMin, { min: 2 }) }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { error: v.emailRequired })
      .email({ error: v.emailInvalid }),
    password: z
      .string()
      .min(8, { error: interpolate(v.passwordMin, { min: 8 }) })
      .regex(/[a-zA-Z]/, { error: v.passwordNeedsLetter })
      .regex(/[0-9]/, { error: v.passwordNeedsDigit }),
    country: z.enum(["KR", "US"], { error: "국가를 선택해주세요" }).optional(),
    // Step 3 (optional): where approval notifications go. Empty host disables
    // mail, exactly like an unset SMTP_HOST — the setup completes regardless.
    ...smtpFieldsSchema(v),
  });
}

export type SetupSmtp = {
  host: string | null;
  port: number | null;
  user: string | null;
  pass: string | null;
  from: string | null;
  secure: boolean;
};