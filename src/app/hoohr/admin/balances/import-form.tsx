"use client";

import { useActionState } from "react";
import { importBalances } from "@/app/actions/leave";
import type { BalanceImportState } from "@/lib/leave-validation";

export function BalanceImportForm() {
  const [state, action, pending] = useActionState<BalanceImportState, FormData>(
    importBalances,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="csv-file" className="text-sm font-medium text-zinc-700">
          CSV 파일
        </label>
        <input
          id="csv-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
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

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "가져오는 중..." : "가져오기"}
      </button>
    </form>
  );
}