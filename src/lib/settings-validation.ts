import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";

const idSchema = z
  .string()
  .trim()
  .min(1, { error: "필수 정보를 입력하세요" })
  .max(100, { error: "필수 정보가 올바르지 않습니다" });

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "날짜를 선택하세요" })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { error: "날짜가 올바르지 않습니다" },
  );

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label}을 입력하세요` })
    .max(100, { error: `${label}은 100자 이내입니다` });

const daysSchema = (label: string) =>
  z.coerce
    .number({ error: `${label}을 입력하세요` })
    .min(0, { error: `${label}은 0 이상이어야 합니다` })
    .max(365, { error: `${label}은 365 이하여야 합니다` });

const booleanSchema = z.enum(["true", "false"], {
  error: "값이 올바르지 않습니다",
});

// ---- SET-1: 회사 설정 ----

export const CompanySettingsSchema = z.object({
  name: nameSchema("회사명"),
  timezone: z
    .string()
    .trim()
    .min(1, { error: "시간대를 선택하세요" })
    .max(100, { error: "시간대가 올바르지 않습니다" }),
});

// ---- SET-2: 휴가 정책 ----

export const LeavePolicyUpdateSchema = z.object({
  id: idSchema,
  name: nameSchema("정책명"),
  annualDays: daysSchema("연간 부여 일수"),
  maxCarryOverDays: daysSchema("이월 한도"),
  isPaid: booleanSchema,
  requiresApproval: booleanSchema,
  active: booleanSchema,
});

export const LeavePolicyIdSchema = z.object({ id: idSchema });

// ---- SET-3: 공휴일 ----

export const HolidayCreateSchema = z.object({
  date: isoDateSchema,
  name: nameSchema("공휴일명"),
});

export const HolidayDeleteSchema = z.object({ id: idSchema });

// ---- SET-4: 경비 분류 ----

export const ExpenseCategoryCreateSchema = z.object({
  name: nameSchema("분류명"),
});

export const ExpenseCategoryUpdateSchema = z.object({
  id: idSchema,
  name: nameSchema("분류명"),
  active: booleanSchema,
});

export const ExpenseCategoryDeleteSchema = z.object({ id: idSchema });

export type SettingsState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type CompanySettingsState = SettingsState;
export type LeavePolicyState = SettingsState;
export type HolidayState = SettingsState;
export type ExpenseCategoryState = SettingsState;
