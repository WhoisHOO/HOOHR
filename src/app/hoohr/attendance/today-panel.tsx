"use client";

import { useActionState } from "react";
import { checkIn, checkOut } from "@/app/actions/attendance";
import type { CheckInOutState } from "@/lib/attendance-validation";
import { interpolate, useI18n } from "@/i18n/client";

export type AttendanceEventItem = {
  kind: "CHECK_IN" | "CHECK_OUT";
  time: string;
};

type Props = {
  todayLabel: string;
  open: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  worked: string;
  events: AttendanceEventItem[];
};

export function TodayPanel({
  todayLabel,
  open,
  checkInAt,
  checkOutAt,
  worked,
  events,
}: Props) {
  const { d } = useI18n();
  const attendance = d.attendance;
  const [checkInState, checkInAction, checkInPending] = useActionState<
    CheckInOutState,
    FormData
  >(checkIn, undefined);
  const [checkOutState, checkOutAction, checkOutPending] = useActionState<
    CheckInOutState,
    FormData
  >(checkOut, undefined);

  const message = checkInState?.message ?? checkOutState?.message ?? null;
  const ok = checkInState?.ok ?? checkOutState?.ok ?? false;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500">
            {interpolate(attendance.today.header, { todayLabel })}
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">
            {open
              ? attendance.today.onWork
              : worked !== "-"
                ? attendance.today.done
                : attendance.today.notCheckedIn}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {interpolate(attendance.today.line, {
              checkIn: checkInAt ?? "-",
              checkOut: checkOutAt ?? "-",
            })}
            {worked !== "-" && (
              <span className="ml-2 text-zinc-400">
                {interpolate(attendance.today.workedValue, { worked })}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <form action={checkInAction}>
            <button
              type="submit"
              disabled={checkInPending || open}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkInPending
                ? attendance.today.processing
                : attendance.today.checkIn}
            </button>
          </form>
          <form action={checkOutAction}>
            <button
              type="submit"
              disabled={checkOutPending || !open}
              className="rounded-md bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkOutPending
                ? attendance.today.processing
                : attendance.today.checkOut}
            </button>
          </form>
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            ok ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-800"
          }`}
        >
          {message}
        </p>
      )}

      {events.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="mb-2 text-xs font-semibold text-zinc-500">
            {interpolate(attendance.today.eventsLabel, {
              count: events.length,
            })}
          </p>
          <ul className="space-y-1">
            {events.map((e, i) => (
              <li key={i} className="flex justify-between text-sm text-zinc-700">
                <span>
                  {e.kind === "CHECK_IN"
                    ? attendance.today.checkIn
                    : attendance.today.checkOut}
                </span>
                <span className="font-medium tabular-nums">{e.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}