"use client";

import { useActionState } from "react";
import { submitExpenseReport } from "@/app/actions/expense";
import type { ExpenseSubmitState } from "@/lib/expense-validation";
import { useI18n } from "@/i18n/client";

export function SubmitExpenseButton({
  reportId,
  disabled,
}: {
  reportId: string;
  disabled: boolean;
}) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ExpenseSubmitState, FormData>(
    submitExpenseReport,
    undefined,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={reportId} />
      {state?.message && (
        <span
          className={`text-xs ${state.ok ? "text-green-600" : "text-red-600"}`}
        >
          {state.message}
        </span>
      )}
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? d.common.buttons.submitting : d.expenses.form.submitForApproval}
      </button>
    </form>
  );
}