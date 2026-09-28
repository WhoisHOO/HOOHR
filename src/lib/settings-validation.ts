import { z } from "zod";
import { interpolate } from "@/i18n/format";
import type { FieldErrors } from "@/lib/auth-validation";
import type { SettingsValidationMessages } from "@/i18n/dictionaries/settings";

/**
 * Schemas are locale-aware factories: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * Actions build them with `(await getDict())`.
 *
 * The `label` argument of the helpers below is the *already localized* field
 * label read from the dictionary, then interpolated into the message template.
 */
const idSchema = (v: SettingsValidationMessages) =>
  z
    .string()
    .trim()
    .min(1, { error: v.validation.idRequired })
    .max(100, { error: v.validation.idInvalid });

const isoDateSchema = (v: SettingsValidationMessages) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: v.validation.dateRequired })
    .refine(
      (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      },
      { error: v.validation.dateInvalid },
    );

const nameSchema = (v: SettingsValidationMessages, label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: v.required })
    .max(100, { error: interpolate(v.validation.nameTooLong, { label }) });

const daysSchema = (v: SettingsValidationMessages, label: string) =>
  z.coerce
    .number({ error: v.required })
    .min(0, { error: interpolate(v.validation.daysNegative, { label }) })
    .max(365, { error: interpolate(v.validation.daysTooMany, { label }) });

const booleanSchema = (v: SettingsValidationMessages) =>
  z.enum(["true", "false"], {
    error: v.validation.valueInvalid,
  });

// ---- SET-1: 회사 설정 ----

export function companySettingsSchema(v: SettingsValidationMessages) {
  return z.object({
    name: nameSchema(v, v.labels.companyName),
    timezone: z
      .string()
      .trim()
      .min(1, { error: v.validation.timezoneRequired })
      .max(100, { error: v.validation.timezoneInvalid }),
  });
}

// ---- SET-2: 휴가 정책 ----

export function leavePolicyUpdateSchema(v: SettingsValidationMessages) {
  return z.object({
    id: idSchema(v),
    name: nameSchema(v, v.labels.policyName),
    annualDays: daysSchema(v, v.labels.annualDays),
    maxCarryOverDays: daysSchema(v, v.labels.maxCarryOver),
    isPaid: booleanSchema(v),
    requiresApproval: booleanSchema(v),
    active: booleanSchema(v),
  });
}

export function leavePolicyIdSchema(v: SettingsValidationMessages) {
  return z.object({ id: idSchema(v) });
}

// ---- SET-3: 공휴일 ----

export function holidayCreateSchema(v: SettingsValidationMessages) {
  return z.object({
    date: isoDateSchema(v),
    name: nameSchema(v, v.labels.holidayName),
  });
}

export function holidayDeleteSchema(v: SettingsValidationMessages) {
  return z.object({ id: idSchema(v) });
}

// ---- SET-4: 경비 분류 ----

export function expenseCategoryCreateSchema(v: SettingsValidationMessages) {
  return z.object({
    name: nameSchema(v, v.labels.categoryName),
  });
}

export function expenseCategoryUpdateSchema(v: SettingsValidationMessages) {
  return z.object({
    id: idSchema(v),
    name: nameSchema(v, v.labels.categoryName),
    active: booleanSchema(v),
  });
}

export function expenseCategoryDeleteSchema(v: SettingsValidationMessages) {
  return z.object({ id: idSchema(v) });
}

export type SettingsState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type CompanySettingsState = SettingsState;
export type LeavePolicyState = SettingsState;
export type HolidayState = SettingsState;
export type ExpenseCategoryState = SettingsState;
