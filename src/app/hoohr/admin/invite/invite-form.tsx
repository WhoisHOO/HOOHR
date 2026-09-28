"use client";

import { useActionState } from "react";
import { inviteEmployee } from "@/app/actions/auth";
import type { InviteState } from "@/lib/auth-validation";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    inviteEmployee,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700">
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {state?.fieldErrors?.email && (
          <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-zinc-700">
          역할
        </label>
        <select
          id="role"
          name="role"
          defaultValue="EMPLOYEE"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="EMPLOYEE">직원 (본인 데이터만)</option>
          <option value="MANAGER">매니저 (팀 승인 권한)</option>
        </select>
        {state?.fieldErrors?.role && (
          <p className="text-sm text-red-600">{state.fieldErrors.role[0]}</p>
        )}
      </div>

      {state?.message && !state.inviteUrl && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "초대 링크 생성 중..." : "초대 링크 생성"}
      </button>

      {state?.inviteUrl && (
        <div className="rounded-md bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">
            {state.message ?? "초대 링크가 생성되었습니다"}
          </p>
          <input
            readOnly
            value={state.inviteUrl}
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </form>
  );
}
