import { z } from "zod";
import { interpolate } from "@/i18n/format";
import type { AuthValidationMessages } from "@/i18n/dictionaries/auth";

/**
 * Schemas are locale-aware factories: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * Actions build them with `(await getDict())`.
 */
export function loginFormSchema(v: AuthValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { error: v.emailRequired })
      .email({ error: v.emailInvalid }),
    password: z.string().min(1, { error: v.passwordRequired }),
  });
}

export function inviteFormSchema(v: AuthValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { error: v.emailRequired })
      .email({ error: v.emailInvalid }),
    name: z.string().trim().min(2, { error: interpolate(v.nameMin, { min: 2 }) }),
    role: z.enum(["EMPLOYEE", "MANAGER"], { error: v.roleRequired }),
  });
}

export function reinviteEmployeeFormSchema(v: AuthValidationMessages) {
  return z.object({
    employeeId: z.string().trim().min(1, { error: v.roleRequired }),
    role: z.enum(["EMPLOYEE", "MANAGER"], { error: v.roleRequired }),
  });
}

export function acceptInviteFormSchema(v: AuthValidationMessages) {
  return z.object({
    name: z.string().trim().min(2, { error: interpolate(v.nameMin, { min: 2 }) }),
    password: z
      .string()
      .min(8, { error: interpolate(v.passwordMin, { min: 8 }) })
      .regex(/[a-zA-Z]/, { error: v.passwordNeedsLetter })
      .regex(/[0-9]/, { error: v.passwordNeedsDigit }),
  });
}

export type FieldErrors = Record<string, string[] | undefined>;

export type LoginState = {
  fieldErrors?: FieldErrors;
  message?: string;
} | undefined;

export type InviteState = {
  fieldErrors?: FieldErrors;
  message?: string;
  inviteUrl?: string;
} | undefined;

export type AcceptInviteState = {
  fieldErrors?: FieldErrors;
  message?: string;
} | undefined;
