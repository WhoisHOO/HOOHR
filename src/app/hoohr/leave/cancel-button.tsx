"use client";

import { useActionState } from "react";
import { cancelLeave } from "@/app/actions/leave";
import type { LeaveCancelState } from "@/lib/leave-validation";
import { useI18n } from "@/i18n/client";

export function CancelLeaveButton({ leaveId }: { leaveId: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<LeaveCancelState, FormData>(
    cancelLeave,
    undefined,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={leaveId} />
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
        className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900 disabled:opacity-50"
      >
        {d.common.actions.cancel}
      </button>
    </form>
  );
}