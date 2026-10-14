"use client";

import { useActionState, useState } from "react";
import { parseWeekendDays, WEEKDAY_KEYS } from "@/lib/company-defaults";
import {
  checkPublicAccess,
  removeCompanyLogo,
  sendTestMail,
  updateCompanyLogo,
  updateCompanyNotice,
  updateCompanySettings,
  updateLeavePolicy,
  updateMailSettings,
} from "@/app/actions/settings";
import {
  MAIL_PRESETS,
  isMailProvider,
  presetForHost,
  type MailProvider,
} from "@/lib/mail-presets";
import type { FieldErrors } from "@/lib/auth-validation";
import type {
  CompanySettingsState,
  LeavePolicyState,
} from "@/lib/settings-validation";
import { interpolate, useI18n } from "@/i18n/client";

export type PolicyView = {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  isPaid: boolean;
  requiresApproval: boolean;
  active: boolean;
};

type ActionState = { fieldErrors?: FieldErrors; message?: string; ok?: boolean };

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

function Message({ state }: { state?: ActionState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

function FieldError({ state, name }: { state?: ActionState; name: string }) {
  const message = state?.fieldErrors?.[name]?.[0];
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

function Section({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        {count && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {count}
          </span>
        )}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

// ---- SET-1 ----

function CompanyForm({
  name,
  weekendDays,
}: CompanyFormProps) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    updateCompanySettings,
    undefined,
  );
  const [weekend, setWeekend] = useState<number[]>(() => {
    const parsed = parseWeekendDays(weekendDays);
    return parsed ? [...parsed] : [0, 6];
  });
  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  function toggleDay(day: number) {
    setWeekend((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day],
    );
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="company-name" className="text-xs font-medium text-zinc-500">
          {d.settings.labels.companyName}
        </label>
        <input
          id="company-name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className={inputClass}
        />
        <FieldError state={state} name="name" />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <span className="text-xs font-medium text-zinc-500">
          {d.settings.labels.weekend}
        </span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_KEYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={weekend.includes(day)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                weekend.includes(day)
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {d.settings.weekdays[weekdayKeys[day]]}
              {weekend.includes(day) ? (
                <input type="hidden" name="weekend" value={String(day)} />
              ) : null}
            </button>
          ))}
        </div>
        <FieldError state={state} name="weekend" />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? d.common.buttons.saving : d.common.actions.save}
      </button>
      <div className="sm:col-span-3">
        <Message state={state} />
      </div>
    </form>
  );
}

type CompanyFormProps = {
  name: string;
  weekendDays: string;
};

function CompanySection(props: CompanyFormProps) {
  const { d } = useI18n();

  return (
    <Section
      title={d.settings.sections.company.title}
      description={d.settings.sections.company.description}
    >
      <CompanyForm {...props} />
    </Section>
  );
}

// ---- SET-1b: 이메일 알림 ----

export type MailView = {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpSecure: boolean;
  hasSmtpPass: boolean;
};

function MailForm({ initial }: { initial: MailView }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    updateMailSettings,
    undefined,
  );
  const [testState, testAction, testPending] = useActionState<CompanySettingsState, FormData>(
    async () => sendTestMail(),
    undefined,
  );
  const [provider, setProvider] = useState<MailProvider>(() =>
    presetForHost(initial.smtpHost),
  );
  const f = d.setup.fields;
  const preset = provider === "custom" ? null : MAIL_PRESETS[provider];
  // Remount the server/port/secure inputs on provider change so the preset
  // values land in the form without controlled inputs.
  const presetKey = provider;

  return (
    <>
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="mail-provider" className="text-xs font-medium text-zinc-500">
          {d.setup.provider}
        </label>
        <select
          id="mail-provider"
          value={provider}
          onChange={(e) => {
            if (isMailProvider(e.target.value)) setProvider(e.target.value);
          }}
          className={inputClass}
        >
          {(Object.keys(d.setup.providers) as MailProvider[]).map((p) => (
            <option key={p} value={p}>
              {d.setup.providers[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="mail-host" className="text-xs font-medium text-zinc-500">
          {f.smtpHost}
        </label>
        <input
          id="mail-host"
          name="smtpHost"
          type="text"
          key={`host-${presetKey}`}
          defaultValue={preset ? preset.host : initial.smtpHost}
          readOnly={preset !== null}
          placeholder="smtp.gmail.com"
          autoComplete="off"
          className={`${inputClass} ${preset ? "bg-zinc-100 text-zinc-500" : ""}`}
        />
        <FieldError state={state} name="smtpHost" />
      </div>
      <div className="flex items-end gap-3">
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="mail-port" className="text-xs font-medium text-zinc-500">
            {f.smtpPort}
          </label>
          <input
            id="mail-port"
            name="smtpPort"
            inputMode="numeric"
            key={`port-${presetKey}`}
            defaultValue={preset ? preset.port : initial.smtpPort}
            readOnly={preset !== null}
            placeholder="587"
            className={`${inputClass} ${preset ? "bg-zinc-100 text-zinc-500" : ""}`}
          />
          <FieldError state={state} name="smtpPort" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs text-zinc-600">
          <input
            id="mail-secure"
            name="smtpSecure"
            type="checkbox"
            value="on"
            key={`sec-${presetKey}`}
            defaultChecked={preset ? preset.secure : initial.smtpSecure}
            disabled={preset !== null}
            className="h-4 w-4"
          />
          {f.smtpSecure}
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="mail-user" className="text-xs font-medium text-zinc-500">
          {f.smtpUser}
        </label>
        <input
          id="mail-user"
          name="smtpUser"
          type="text"
          defaultValue={initial.smtpUser}
          autoComplete="off"
          placeholder={d.setup.accountHint}
          className={inputClass}
        />
        <FieldError state={state} name="smtpUser" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="mail-pass" className="text-xs font-medium text-zinc-500">
          {f.smtpPass}
        </label>
        <input
          id="mail-pass"
          name="smtpPass"
          type="password"
          autoComplete="new-password"
          placeholder={initial.hasSmtpPass ? d.settings.sections.mail.passKept : undefined}
          className={inputClass}
        />
        <p className="text-xs text-zinc-500">{d.setup.passHints[provider]}</p>
        <FieldError state={state} name="smtpPass" />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="mail-from" className="text-xs font-medium text-zinc-500">
          {f.smtpFrom}
        </label>
        <input
          id="mail-from"
          name="smtpFrom"
          type="email"
          defaultValue={initial.smtpFrom}
          autoComplete="off"
          placeholder={d.setup.fromHint}
          className={inputClass}
        />
        <FieldError state={state} name="smtpFrom" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? d.common.buttons.saving : d.common.actions.save}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Message state={state} />
      </div>
      {preset?.secure && <input type="hidden" name="smtpSecure" value="on" />}
    </form>
    <form action={testAction} className="mt-3 border-t border-zinc-100 pt-3">
      <button type="submit" disabled={testPending} className={secondaryButtonClass}>
        {testPending ? d.settings.sections.mail.sending : d.settings.sections.mail.testSend}
      </button>
      <div className="mt-2">
        <Message state={testState} />
      </div>
    </form>
    </>
  );
}

function MailSection({ initial }: { initial: MailView }) {
  const { d } = useI18n();

  return (
    <Section
      title={d.settings.sections.mail.title}
      description={d.settings.sections.mail.description}
    >
      <MailForm initial={initial} />
    </Section>
  );
}

// ---- SET-1e: 외부 접속 ----

export type ExternalView = {
  url: string | null;
  kind: "none" | "quick" | "stable";
};

function ExternalSection({ view }: { view: ExternalView }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    async () => checkPublicAccess(),
    undefined,
  );
  const note =
    view.kind === "quick"
      ? d.settings.sections.external.quick
      : view.kind === "stable"
        ? d.settings.sections.external.stable
        : d.settings.sections.external.none;

  return (
    <Section
      title={d.settings.sections.external.title}
      description={d.settings.sections.external.description}
    >
      {view.url ? (
        <p className="truncate text-sm font-medium text-zinc-900">
          <a
            href={view.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 underline hover:text-blue-900"
          >
            {view.url}
          </a>
        </p>
      ) : null}
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
      <form action={action} className="mt-3">
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? d.settings.sections.external.check + "…" : d.settings.sections.external.check}
        </button>
        <div className="mt-2">
          <Message state={state} />
        </div>
      </form>
    </Section>
  );
}

// ---- SET-1f: 이사 (백업/복원) ----

function TransferSection() {
  const { d } = useI18n();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRestore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!(form.get("backup") instanceof File)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/hoohr/admin/transfer", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      setResult({
        ok: res.ok && json?.ok === true,
        message: json?.message ?? "",
      });
    } catch {
      setResult({ ok: false, message: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={d.settings.sections.transfer.title}
      description={d.settings.sections.transfer.description}
    >
      <a
        href="/hoohr/admin/transfer"
        className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {d.settings.sections.transfer.download}
      </a>
      <form onSubmit={onRestore} className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">
            {d.settings.sections.transfer.file}
          </label>
          <input name="backup" type="file" required accept="application/json,.json" className="text-sm text-zinc-700" />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input name="confirm" type="checkbox" value="yes" required className="h-4 w-4" />
          {d.settings.sections.transfer.confirm}
        </label>
        <div>
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? d.settings.sections.transfer.restoring : d.settings.sections.transfer.restore}
          </button>
        </div>
        {result && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {result.message}
          </p>
        )}
      </form>
    </Section>
  );
}

// ---- SET-1d: 공지사항 ----

function NoticeSection({ initial }: { initial: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    updateCompanyNotice,
    undefined,
  );

  return (
    <Section
      title={d.settings.sections.notice.title}
      description={d.settings.sections.notice.description}
    >
      <form action={action} className="flex flex-col gap-3">
        <textarea
          name="notice"
          rows={3}
          maxLength={500}
          defaultValue={initial}
          placeholder={d.settings.sections.notice.placeholder}
          className={inputClass}
        />
        <FieldError state={state} name="notice" />
        <div>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? d.common.buttons.saving : d.common.actions.save}
          </button>
        </div>
        <Message state={state} />
      </form>
    </Section>
  );
}

// ---- SET-1c: 회사 로고 ----

function LogoSection({ logoSet }: { logoSet: boolean }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    updateCompanyLogo,
    undefined,
  );
  const [rmState, rmAction, rmPending] = useActionState<CompanySettingsState, FormData>(
    async () => removeCompanyLogo(),
    undefined,
  );

  return (
    <Section
      title={d.settings.sections.logo.title}
      description={d.settings.sections.logo.description}
    >
      {logoSet && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hoohr/logo"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg border border-zinc-200 object-contain"
          />
        </div>
      )}
      <form action={action} encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <input
            name="logo"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="text-sm text-zinc-700"
          />
          <FieldError state={state} name="logo" />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? d.common.buttons.saving : d.common.actions.save}
        </button>
      </form>
      <div className="mt-2">
        <Message state={state} />
      </div>
      {logoSet && (
        <form action={rmAction} className="mt-3">
          <button type="submit" disabled={rmPending} className={secondaryButtonClass}>
            {d.common.actions.delete}
          </button>
          <div className="mt-2">
            <Message state={rmState} />
          </div>
        </form>
      )}
    </Section>
  );
}

// ---- SET-2 ----

function PolicyRow({ policy }: { policy: PolicyView }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<LeavePolicyState, FormData>(
    updateLeavePolicy,
    undefined,
  );

  return (
    <article className="rounded-lg border border-zinc-200 p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={policy.id} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
            {policy.kindLabel}
          </span>
          <input
            name="name"
            type="text"
            required
            defaultValue={policy.name}
            aria-label={d.settings.labels.policyName}
            className={`${inputClass} max-w-48`}
          />
          {!policy.active && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              {d.settings.labels.inactive}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="isPaid"
              defaultChecked={policy.isPaid}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600"
            />
            {d.settings.labels.isPaid}
          </label>
          <div className="flex flex-col gap-2 text-sm text-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="requiresApproval"
                defaultChecked={policy.requiresApproval}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              {d.settings.labels.requiresApproval}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={policy.active}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              {d.settings.labels.inUse}
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? d.common.buttons.saving : d.settings.actions.savePolicy}
          </button>
          <Message state={state} />
        </div>
      </form>
    </article>
  );
}

function PolicySection({ policies }: { policies: PolicyView[] }) {
  const { d } = useI18n();

  return (
    <Section
      title={d.settings.sections.policy.title}
      description={d.settings.sections.policy.description}
      count={interpolate(d.settings.counts.items, { n: policies.length })}
    >
      {policies.map((policy) => (
        <PolicyRow key={policy.id} policy={policy} />
      ))}
    </Section>
  );
}

export function SettingsClient({
  companyName,
  weekendDays,
  mail,
  logoSet,
  notice,
  external,
  policies,
}: {
  companyName: string;
  weekendDays: string;
  mail: MailView;
  logoSet: boolean;
  notice: string;
  external: ExternalView;
  policies: PolicyView[];
}) {
  return (
    <div className="space-y-8">
      <CompanySection
        name={companyName}
        weekendDays={weekendDays}
      />
      <MailSection initial={mail} />
      <LogoSection logoSet={logoSet} />
      <NoticeSection initial={notice} />
      <ExternalSection view={external} />
      <TransferSection />
      <PolicySection policies={policies} />
    </div>
  );
}
