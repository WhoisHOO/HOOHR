import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";
import type { LeaveValidationMessages } from "@/i18n/dictionaries/leave";

/**
 * Schemas are locale-aware factories: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * Actions build them with `(await getDict())`.
 */
export function leaveRequestFormSchema(v: LeaveValidationMessages) {
  return z.object({
    policyId: z.string().min(1, { error: v.validation.policyRequired }),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.startDateRequired,
    }),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.endDateRequired,
    }),
    // An unchecked checkbox is omitted from FormData entirely, so the action
    // sends the empty string here. It must count as "not a half day", not as
    // an invalid value: .optional() only tolerates undefined, and "" was
    // rejected, which made every leave request fail validation silently.
    isHalfDay: z
      .enum(["", "false", "true", "1", "on"], { error: v.validation.invalidHalfDay })
      .optional(),
    reason: z
      .string()
      .trim()
      .max(500, { error: v.validation.reasonTooLong })
      .optional(),
  });
}

export function balanceRowSchema(v: LeaveValidationMessages) {
  return z.object({
    email: z.string().trim().email({ error: v.balanceImport.emailFormat }),
    kind: z.enum(["PTO", "SICK", "UNPAID"]),
    year: z.coerce.number().int().min(2000).max(2100),
    grantedDays: z.coerce.number().min(0).max(1000),
    usedDays: z.coerce.number().min(0).max(1000).default(0),
    adjustDays: z.coerce.number().min(-1000).max(1000).default(0),
  });
}

export type LeaveRequestState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type LeaveDecideState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type LeaveCancelState = {
  message?: string;
  ok?: boolean;
} | undefined;

export type BalanceImportState = {
  message?: string;
  ok?: boolean;
} | undefined;