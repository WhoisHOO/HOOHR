"use client";

import { useActionState } from "react";
import { decideExpense } from "@/app/actions/expense";
import type { ExpenseDecideState } from "@/lib/expense-validation";

export function DecideExpenseForm({
  reportId,
  mode,
}: {
  reportId: string;
  mode: "approve" | "pay";
}) {
  const [state, action, pending] = useActionState<ExpenseDecideState, FormData>(
    decideExpense,
    undefined,
  );

  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
      <input type="hidden" name="id" value={reportId} />
      <div className="flex flex-col gap-1">
        <input
          name="comment"
          type="text"
          placeholder={
            mode === "pay"
              ? "지급 메모 (선택)"
              : "승인/반려 의견 (반려 시 필수)"
          }
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        {mode === "approve" ? (
          <>
            <button
              type="submit"
              name="decision"
              value="APPROVE"
              disabled={pending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              승인
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECT"
              disabled={pending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              반려
            </button>
          </>
        ) : (
          <button
            type="submit"
            name="decision"
            value="PAY"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            지급 확정
          </button>
        )}
      </div>
    </form>
  );
}