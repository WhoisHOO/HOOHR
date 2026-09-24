import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";

export const ExpenseReportCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "제목을 입력하세요" })
    .max(100, { error: "제목은 100자 이내입니다" }),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "시작 날짜를 선택하세요",
  }),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "종료 날짜를 선택하세요",
  }),
});

export const ExpenseItemFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "날짜를 선택하세요" }),
  categoryId: z.string().min(1, { error: "카테고리를 선택하세요" }),
  amountLabel: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, { error: "금액 형식이 올바르지 않습니다" }),
  description: z
    .string()
    .trim()
    .max(200, { error: "설명은 200자 이내입니다" })
    .optional(),
});

export const MAX_EXPENSE_ITEMS = 20;

export type ExpenseCreateState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type ExpenseSubmitState = {
  message?: string;
  ok?: boolean;
} | undefined;

export type ExpenseDeleteState = {
  message?: string;
  ok?: boolean;
} | undefined;

export type ExpenseDecideState = {
  message?: string;
  ok?: boolean;
} | undefined;