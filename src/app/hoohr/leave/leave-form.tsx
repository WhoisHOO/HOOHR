"use client";

import { useActionState, useMemo, useState } from "react";
import { requestLeave } from "@/app/actions/leave";
import { countWorkdays } from "@/lib/leave";
import { isWorkday } from "@/lib/holidays";
import type { LeaveRequestState } from "@/lib/leave-validation";
import { useI18n, interpolate } from "@/i18n/client";

export type LeavePolicyOption = {
  id: string;
  name: string;
  kind: string;
  remaining: number | null;
};

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function LeaveRequestForm({
  policies,
  today,
  holidays,
}: {
  policies: LeavePolicyOption[];
  today: string;
  holidays: string[];
}) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<LeaveRequestState, FormData>(
    requestLeave,
    undefined,
  );

  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [isHalfDay, setIsHalfDay] = useState(false);

  const selected = policies.find((p) => p.id === policyId);
  const start: Date | null = parseIso(startDate);
  const end: Date | null = isHalfDay ? start : parseIso(endDate);
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const days =
    start && end && start.getTime() <= end.getTime() && !isHalfDay
      ? countWorkdays(start, end, holidaySet)
      : isHalfDay && start
        ? 0.5
        : 0;
  const remaining = selected?.remaining ?? null;
  const remainingAfter = remaining !== null ? Math.max(0, remaining - days) : null;
  const over = remaining !== null && days > remaining;
  // Server refuses a half-day on a weekend/holiday; mirror it so the button state matches.
  const halfDayBlocked = isHalfDay && start !== null && !isWorkday(start, holidaySet);
  const blocked = over || halfDayBlocked || days <= 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="lv-policy" className="text-sm font-medium text-zinc-700">
            {d.leave.form.type}
          </label>
          <select
            id="lv-policy"
            name="policyId"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.remaining !== null
                  ? ` ${interpolate(d.leave.form.optionRemaining, { n: p.remaining })}`
                  : ""}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.policyId && (
            <p className="text-sm text-red-600">{state.fieldErrors.policyId[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="lv-start" className="text-sm font-medium text-zinc-700">
            {d.leave.form.startDate}
          </label>
          <input
            id="lv-start"
            name="startDate"
            type="date"
            required
            min={today}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (isHalfDay) setEndDate(e.target.value);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {state?.fieldErrors?.startDate && (
            <p className="text-sm text-red-600">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="lv-end" className="text-sm font-medium text-zinc-700">
            {d.leave.form.endDate}
          </label>
          <input
            id="lv-end"
            name="endDate"
            type="date"
            required
            min={today}
            disabled={isHalfDay}
            value={isHalfDay ? startDate : endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-400"
          />
          {state?.fieldErrors?.endDate && (
            <p className="text-sm text-red-600">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="isHalfDay"
          value="on"
          checked={isHalfDay}
          onChange={(e) => {
            setIsHalfDay(e.target.checked);
            if (e.target.checked) setEndDate(startDate);
          }}
          className="h-4 w-4 rounded border-zinc-300 text-blue-600"
        />
        {d.leave.form.halfDay}
      </label>
      {state?.fieldErrors?.isHalfDay && (
        <p className="-mt-2 text-sm text-red-600">{state.fieldErrors.isHalfDay[0]}</p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="lv-reason" className="text-sm font-medium text-zinc-700">
          {d.common.fields.reason} ({d.common.buttons.optional})
        </label>
        <textarea
          id="lv-reason"
          name="reason"
          rows={2}
          placeholder={d.leave.form.reasonPlaceholder}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {state?.fieldErrors?.reason && (
          <p className="text-sm text-red-600">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {d.leave.form.selected}{" "}
          <span className="font-semibold text-zinc-900">
            {interpolate(d.common.units.days, { n: days })}
          </span>
          {remaining !== null && (
            <>
              {" · "}
              <span className={`font-semibold ${over ? "text-red-600" : "text-zinc-900"}`}>
                {interpolate(d.leave.form.remaining, { n: remainingAfter ?? 0 })}
              </span>
            </>
          )}
        </p>
        <button
          type="submit"
          disabled={pending || blocked}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? d.leave.form.submitting : d.leave.form.submit}
        </button>
      </div>

      {halfDayBlocked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {d.leave.form.halfDayBlocked}
        </p>
      )}

      {over && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {interpolate(d.leave.form.overBalance, { days, remaining: remaining ?? 0 })}
        </p>
      )}

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