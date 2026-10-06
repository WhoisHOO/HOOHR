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
  });
}
