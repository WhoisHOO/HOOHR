"use client";

import { useActionState } from "react";
import { submitCorrection } from "@/app/actions/attendance";
import type { AttendanceCorrectionState } from "@/lib/attendance-validation";

const TYPE_OPTIONS = [
  { value: "ADD", label: "기록 누락 (출근/퇴근 기록이 없음)" },
  { value: "EDIT", label: "시간 수정 (기록된 시간이 오류)" },
  { value: "FIX", label: "기록 오류 (잘못된 날짜/중복 등)" },
];

export function CorrectionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<
    AttendanceCorrectionState,
    FormData
  >(submitCorrection, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="corr-date" className="text-sm font-medium text-zinc-700">
            날짜
          </label>
          <input
            id="corr-date"
            name="date"
            type="date"
            required
            max={today}
            defaultValue={today}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {state?.fieldErrors?.date && (
            <p className="text-sm text-red-600">{state.fieldErrors.date[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="corr-type"
            className="text-sm font-medium text-zinc-700"
          >
            정정 유형
          </label>
          <select
            id="corr-type"
            name="requestType"
            defaultValue="ADD"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.requestType && (
            <p className="text-sm text-red-600">
              {state.fieldErrors.requestType[0]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="corr-note" className="text-sm font-medium text-zinc-700">
          정정 사유
        </label>
        <textarea
          id="corr-note"
          name="note"
          required
          rows={2}
          placeholder="예: 9월 20일 출근 버튼을 누르지 않아 기록이 없습니다"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {state?.fieldErrors?.note && (
          <p className="text-sm text-red-600">{state.fieldErrors.note[0]}</p>
        )}
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
        {pending ? "접수 중..." : "정정 요청"}
      </button>
    </form>
  );
}