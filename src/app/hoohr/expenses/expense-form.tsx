"use client";

import { useActionState, useState } from "react";
import { createExpenseReport } from "@/app/actions/expense";
import { parseAmountToCents } from "@/lib/expense";
import type { ExpenseCreateState } from "@/lib/expense-validation";
import { useI18n, INTL_LOCALES } from "@/i18n/client";

export type ExpenseCategoryOption = {
  id: string;
  name: string;
};

type ItemRow = {
  key: number;
  date: string;
  categoryId: string;
  amount: string;
  description: string;
  fileName: string;
};

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function NewExpenseForm({
  categories,
}: {
  categories: ExpenseCategoryOption[];
}) {
  const { d, locale } = useI18n();
  const [state, action, pending] = useActionState<ExpenseCreateState, FormData>(
    createExpenseReport,
    undefined,
  );

  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState(todayStr());
  const [periodEnd, setPeriodEnd] = useState(todayStr());
  const [rows, setRows] = useState<ItemRow[]>([
    {
      key: 0,
      date: todayStr(),
      categoryId: categories[0]?.id ?? "",
      amount: "",
      description: "",
      fileName: "",
    },
  ]);

  const totalCents = rows.reduce(
    (sum, r) => sum + (parseAmountToCents(r.amount) || 0),
    0,
  );
  const totalLabel =
    totalCents > 0
      ? (totalCents / 100).toLocaleString(INTL_LOCALES[locale], {
          minimumFractionDigits: 2,
        })
      : "-";

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: prev.length,
        date: todayStr(),
        categoryId: categories[0]?.id ?? "",
        amount: "",
        description: "",
        fileName: "",
      },
    ]);
  };

  const removeRow = (key: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const inputCls =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="ex-title" className="text-sm font-medium text-zinc-700">
            {d.expenses.form.title}
          </label>
          <input
            id="ex-title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={d.expenses.form.titlePlaceholder}
            className={inputCls}
          />
          {state?.fieldErrors?.title && (
            <p className="text-sm text-red-600">{state.fieldErrors.title[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ex-start" className="text-sm font-medium text-zinc-700">
            {d.expenses.form.periodStart}
          </label>
          <input
            id="ex-start"
            name="periodStart"
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ex-end" className="text-sm font-medium text-zinc-700">
            {d.expenses.form.periodEnd}
          </label>
          <input
            id="ex-end"
            name="periodEnd"
            type="date"
            required
            min={periodStart}
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      {state?.fieldErrors?.periodStart && (
        <p className="text-sm text-red-600">{state.fieldErrors.periodStart[0]}</p>
      )}
      {state?.fieldErrors?.periodEnd && (
        <p className="text-sm text-red-600">{state.fieldErrors.periodEnd[0]}</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`ex-item-date-${row.key}`}
                  className="text-xs font-medium text-zinc-500"
                >
                  {d.common.fields.date}
                </label>
                <input
                  id={`ex-item-date-${row.key}`}
                  name="item_date"
                  type="date"
                  required
                  value={row.date}
                  onChange={(e) => updateRow(row.key, { date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`ex-item-cat-${row.key}`}
                  className="text-xs font-medium text-zinc-500"
                >
                  {d.expenses.form.category}
                </label>
                <select
                  id={`ex-item-cat-${row.key}`}
                  name="item_categoryId"
                  value={row.categoryId}
                  onChange={(e) => updateRow(row.key, { categoryId: e.target.value })}
                  className={inputCls}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`ex-item-amount-${row.key}`}
                  className="text-xs font-medium text-zinc-500"
                >
                  {d.expenses.form.amountLabel}
                </label>
                <input
                  id={`ex-item-amount-${row.key}`}
                  name="item_amount"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="12.50"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`ex-item-desc-${row.key}`}
                  className="text-xs font-medium text-zinc-500"
                >
                  {d.expenses.form.description}
                </label>
                <input
                  id={`ex-item-desc-${row.key}`}
                  name="item_description"
                  type="text"
                  placeholder={d.expenses.form.descriptionPlaceholder}
                  value={row.description}
                  onChange={(e) =>
                    updateRow(row.key, { description: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`ex-item-file-${row.key}`}
                  className="text-xs font-medium text-zinc-500"
                >
                  {d.expenses.form.receiptOptional}
                </label>
                <input
                  id={`ex-item-file-${row.key}`}
                  name="item_file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) =>
                    updateRow(row.key, { fileName: e.target.files?.[0]?.name ?? "" })
                  }
                  className="text-xs text-zinc-500 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-300"
                />
                {row.fileName && (
                  <span className="truncate text-xs text-zinc-400">
                    {row.fileName}
                  </span>
                )}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length <= 1}
                  className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {d.common.actions.delete}
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-blue-400 hover:text-blue-600"
        >
          {d.expenses.form.addItem}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {d.common.fields.total}:{" "}
          <span className="font-semibold text-zinc-900">${totalLabel}</span>
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? d.common.buttons.saving : d.expenses.form.createReport}
        </button>
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
    </form>
  );
}