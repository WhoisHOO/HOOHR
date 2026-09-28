"use client";

import { useActionState } from "react";
import { checkIn, checkOut } from "@/app/actions/attendance";
import type { CheckInOutState } from "@/lib/attendance-validation";

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
          <p className="text-xs font-medium text-zinc-500">오늘 · {todayLabel}</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">
            {open ? "근무 중" : worked !== "-" ? "퇴근 완료" : "미출근"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            출근 {checkInAt} · 퇴근 {checkOutAt}
            {worked !== "-" && <span className="ml-2 text-zinc-400">근무 {worked}</span>}
          </p>
        </div>

        <div className="flex gap-2">
          <form action={checkInAction}>
            <button
              type="submit"
              disabled={checkInPending || open}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkInPending ? "처리 중..." : "출근"}
            </button>
          </form>
          <form action={checkOutAction}>
            <button
              type="submit"
              disabled={checkOutPending || !open}
              className="rounded-md bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkOutPending ? "처리 중..." : "퇴근"}
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
            오늘 출입 기록 ({events.length})
          </p>
          <ul className="space-y-1">
            {events.map((e, i) => (
              <li key={i} className="flex justify-between text-sm text-zinc-700">
                <span>{e.kind === "CHECK_IN" ? "출근" : "퇴근"}</span>
                <span className="font-medium tabular-nums">{e.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}