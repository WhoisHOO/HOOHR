import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";
import type { ExpenseValidationMessages } from "@/i18n/dictionaries/expenses";

/**
 * Schemas are locale-aware factories: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * Actions build them with `(await getDict())`.
 */
export function expenseReportCreateSchema(v: ExpenseValidationMessages) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, { error: v.validation.titleRequired })
      .max(100, { error: v.validation.titleTooLong }),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.startDateRequired,
    }),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.endDateRequired,
    }),
  });
}

export function expenseItemFormSchema(v: ExpenseValidationMessages) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.dateRequired,
    }),
    categoryId: z.string().min(1, { error: v.validation.categoryRequired }),
    amountLabel: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, { error: v.validation.amountInvalid }),
    description: z
      .string()
      .trim()
      .max(200, { error: v.validation.descriptionTooLong })
      .optional(),
  });
}

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