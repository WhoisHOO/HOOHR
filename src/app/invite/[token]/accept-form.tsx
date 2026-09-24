"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions/auth";
import type { AcceptInviteState } from "@/lib/auth-validation";

export function AcceptInviteForm({ token }: { token: string }) {
  const action = acceptInvitation.bind(null, token);
  const [state, formAction, pending] = useActionState<
    AcceptInviteState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="text-xs text-zinc-500">8자 이상, 영문·숫자 포함</p>
        {state?.fieldErrors?.password && (
          <p className="text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "처리 중..." : "가입하고 시작하기"}
      </button>
    </form>
  );
}
