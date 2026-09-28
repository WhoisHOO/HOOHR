"use client";

import { useActionState } from "react";
import { deleteExpenseReport } from "@/app/actions/expense";
import type { ExpenseDeleteState } from "@/lib/expense-validation";
import { useI18n } from "@/i18n/client";

export function DeleteExpenseButton({ reportId }: { reportId: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ExpenseDeleteState, FormData>(
    deleteExpenseReport,
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
        disabled={pending}
        className="text-xs font-medium text-zinc-500 underline hover:text-red-600 disabled:opacity-50"
      >
        {d.common.actions.delete}
      </button>
    </form>
  );
}