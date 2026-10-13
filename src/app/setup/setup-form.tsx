"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createFirstAdmin } from "@/app/actions/setup";
import type { SetupState } from "@/lib/setup-validation";
import { useI18n } from "@/i18n/client";

const COMPANY_FIELDS = ["companyName", "locale"];
const ADMIN_FIELDS = ["name", "email", "password"];

export function SetupForm({ defaultCompanyName }: { defaultCompanyName: string }) {
  const { d } = useI18n();
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createFirstAdmin,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // If the server sends back field errors, open the step that owns them so
  // the user sees the problem instead of a bare banner.
  const errorStep = useMemo(() => {
    const keys = Object.keys(state?.fieldErrors ?? {});
    if (keys.some((k) => COMPANY_FIELDS.includes(k))) return 0;
    if (keys.some((k) => ADMIN_FIELDS.includes(k))) return 1;
    if (keys.length > 0) return 2;
    return null;
  }, [state]);
  const [stepOverride, setStepOverride] = useState<number | null>(null);
  const step = errorStep ?? stepOverride ?? 0;

  const go = (next: number) => {
    if (next > step) {
      // `required` lives only on the visible step's inputs (see below), so
      // this validates exactly the visible step and nothing else.
      if (!formRef.current?.reportValidity()) return;
    }
    setStepOverride(next);
  };

  const stepLabels = [d.setup.steps.company, d.setup.steps.admin, d.setup.steps.mail];

  // All three steps stay mounted (values ride along to the single submit at
  // the end); inactive steps are CSS-hidden and carry no `required`.
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <ol className="flex items-center gap-1 text-xs font-medium">
        {stepLabels.map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-md px-2 py-1.5 text-center ${
              i === step
                ? "bg-blue-600 text-white"
                : i < step
                  ? "bg-blue-100 text-blue-800"
                  : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      <div hidden={step !== 0}>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500">{d.setup.companyHint}</p>
          <Field label={d.setup.fields.companyName} error={state?.fieldErrors?.companyName?.[0]}>
            <input id="companyName" name="companyName" required={step === 0} defaultValue={defaultCompanyName} className={inputCls} />
          </Field>
          <Field label={d.setup.fields.language} error={state?.fieldErrors?.locale?.[0]}>
            <select id="locale" name="locale" className={inputCls} required={step === 0}>
              <option value="ko">{d.setup.languages.ko}</option>
              <option value="en">{d.setup.languages.en}</option>
            </select>
          </Field>
        </div>
      </div>

      <div hidden={step !== 1}>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500">{d.setup.adminHint}</p>
          <Field label={d.setup.fields.name} error={state?.fieldErrors?.name?.[0]}>
            <input id="name" name="name" required={step === 1} className={inputCls} autoComplete="name" />
          </Field>
          <Field label={d.setup.fields.email} error={state?.fieldErrors?.email?.[0]}>
            <input id="email" name="email" type="email" required={step === 1} className={inputCls} autoComplete="email" />
          </Field>
          <Field label={d.setup.fields.password} error={state?.fieldErrors?.password?.[0]}>
            <input id="password" name="password" type="password" required={step === 1} autoComplete="new-password" className={inputCls} />
          </Field>
        </div>
      </div>

      <div hidden={step !== 2}>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500">{d.setup.mailHint}</p>
          <Field label={d.setup.fields.smtpHost} error={state?.fieldErrors?.smtpHost?.[0]}>
            <input id="smtpHost" name="smtpHost" className={inputCls} autoComplete="off" placeholder="smtp.gmail.com" />
          </Field>
          <div className="flex items-center gap-3">
            <div className="w-28">
              <Field label={d.setup.fields.smtpPort} error={state?.fieldErrors?.smtpPort?.[0]}>
                <input id="smtpPort" name="smtpPort" inputMode="numeric" className={inputCls} placeholder="587" />
              </Field>
            </div>
            <label className="mt-5 flex items-center gap-2 text-xs text-zinc-600">
              <input id="smtpSecure" name="smtpSecure" type="checkbox" value="on" className="h-4 w-4" />
              {d.setup.fields.smtpSecure}
            </label>
          </div>
          <Field label={d.setup.fields.smtpUser} error={state?.fieldErrors?.smtpUser?.[0]}>
            <input id="smtpUser" name="smtpUser" className={inputCls} autoComplete="off" />
          </Field>
          <Field label={d.setup.fields.smtpPass} error={state?.fieldErrors?.smtpPass?.[0]}>
            <input id="smtpPass" name="smtpPass" type="password" className={inputCls} autoComplete="new-password" />
          </Field>
          <Field label={d.setup.fields.smtpFrom} error={state?.fieldErrors?.smtpFrom?.[0]}>
            <input id="smtpFrom" name="smtpFrom" type="email" className={inputCls} autoComplete="off" />
          </Field>
        </div>
      </div>

      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            {d.setup.back}
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {d.setup.next}
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? d.setup.submitting : d.setup.submit}
          </button>
        )}
      </div>
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
