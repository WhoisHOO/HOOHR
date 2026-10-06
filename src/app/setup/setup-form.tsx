"use client";

import { useActionState } from "react";
import { createFirstAdmin } from "@/app/actions/setup";
import type { SetupState } from "@/lib/setup-validation";
import { useI18n } from "@/i18n/client";

export function SetupForm({ defaultCompanyName }: { defaultCompanyName: string }) {
  const { d } = useI18n();
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createFirstAdmin,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label={d.setup.fields.companyName} error={state?.fieldErrors?.companyName?.[0]}>
        <input id="companyName" name="companyName" required defaultValue={defaultCompanyName} className={inputCls} />
      </Field>
      <Field label={d.setup.fields.name} error={state?.fieldErrors?.name?.[0]}>
        <input id="name" name="name" required className={inputCls} />
      </Field>
      <Field label={d.setup.fields.email} error={state?.fieldErrors?.email?.[0]}>
        <input id="email" name="email" type="email" required className={inputCls} />
      </Field>
      <Field label={d.setup.fields.password} error={state?.fieldErrors?.password?.[0]}>
        <input id="password" name="password" type="password" required autoComplete="new-password" className={inputCls} />
      </Field>

      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? d.setup.submitting : d.setup.submit}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
