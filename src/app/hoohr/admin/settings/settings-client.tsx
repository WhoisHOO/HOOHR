"use client";

import { useActionState, useState } from "react";
import { parseWeekendDays, WEEKDAY_KEYS } from "@/lib/company-defaults";
import { COUNTRIES, COUNTRY_DEFAULTS, COUNTRY_LABELS } from "@/lib/country";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateCompanySettings,
  updateExpenseCategory,
  updateLeavePolicy,
} from "@/app/actions/settings";
import type { FieldErrors } from "@/lib/auth-validation";
import type {
  CompanySettingsState,
  ExpenseCategoryState,
  LeavePolicyState,
} from "@/lib/settings-validation";
import { interpolate, useI18n } from "@/i18n/client";

export type PolicyView = {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  annualDays: number;
  maxCarryOverDays: number;
  isPaid: boolean;
  requiresApproval: boolean;
  active: boolean;
};

export type CategoryView = {
  id: string;
  name: string;
  active: boolean;
  itemCount: number;
};

type ActionState = { fieldErrors?: FieldErrors; message?: string; ok?: boolean };

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

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
  country,
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
      <div className="flex flex-col gap-1">
        <label htmlFor="company-country" className="text-xs font-medium text-zinc-500">
          {d.settings.labels.country}
        </label>
        <select
          id="company-country"
          name="country"
          defaultValue={country}
          className={inputClass}
        >
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {COUNTRY_LABELS[code]} ({COUNTRY_DEFAULTS[code].currency})
            </option>
          ))}
        </select>
        <FieldError state={state} name="country" />
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
  country: string;
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">
              {d.settings.labels.annualDays}
            </label>
            <input
              name="annualDays"
              type="number"
              step="0.5"
              min="0"
              required
              defaultValue={policy.annualDays}
              className={inputClass}
            />
            <FieldError state={state} name="annualDays" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">
              {d.settings.labels.maxCarryOver}
            </label>
            <input
              name="maxCarryOverDays"
              type="number"
              step="0.5"
              min="0"
              required
              defaultValue={policy.maxCarryOverDays}
              className={inputClass}
            />
            <FieldError state={state} name="maxCarryOverDays" />
          </div>
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

// ---- SET-4 ----

function CategoryRow({ category }: { category: CategoryView }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ExpenseCategoryState, FormData>(
    updateExpenseCategory,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<
    ExpenseCategoryState,
    FormData
  >(deleteExpenseCategory, undefined);

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-zinc-100 py-2 text-sm">
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={category.id} />
        <input
          name="name"
          type="text"
          required
          defaultValue={category.name}
          aria-label={d.settings.labels.categoryName}
          className={`${inputClass} max-w-48`}
        />
        <label className="flex items-center gap-1 text-xs text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={category.active}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
          />
          {d.settings.labels.inUse}
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? d.common.buttons.saving : d.common.actions.save}
        </button>
      </form>
      <span className="text-xs text-zinc-400">
        {interpolate(d.settings.counts.categoryItems, { n: category.itemCount })}
      </span>
      {!category.active && (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
          {d.settings.labels.inactive}
        </span>
      )}
      <form action={deleteAction}>
        <input type="hidden" name="id" value={category.id} />
        <button
          type="submit"
          disabled={deletePending || category.itemCount > 0}
          title={
            category.itemCount > 0 ? d.settings.hints.deleteBlocked : undefined
          }
          className={dangerButtonClass}
        >
          {deletePending ? d.settings.pending.deleting : d.common.actions.delete}
        </button>
      </form>
      <div className="w-full space-y-1">
        <Message state={state} />
        <Message state={deleteState} />
      </div>
    </li>
  );
}

function CategorySection({ categories }: { categories: CategoryView[] }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ExpenseCategoryState, FormData>(
    createExpenseCategory,
    undefined,
  );

  return (
    <Section
      title={d.settings.sections.category.title}
      description={d.settings.sections.category.description}
      count={interpolate(d.settings.counts.items, { n: categories.length })}
    >
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="category-name" className="text-xs font-medium text-zinc-500">
            {d.settings.labels.newCategoryName}
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            placeholder={d.settings.placeholders.categoryName}
            className={inputClass}
          />
          <FieldError state={state} name="name" />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? d.settings.pending.addingCategory : d.settings.actions.addCategory}
        </button>
        <Message state={state} />
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">{d.settings.empty.categories}</p>
      ) : (
        <ul>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function SettingsClient({
  companyName,
  country,
  weekendDays,
  policies,
  categories,
}: {
  companyName: string;
  country: string;
  weekendDays: string;
  policies: PolicyView[];
  categories: CategoryView[];
}) {
  return (
    <div className="space-y-8">
      <CompanySection
        name={companyName}
        country={country}
        weekendDays={weekendDays}
      />
      <PolicySection policies={policies} />
      <CategorySection categories={categories} />
    </div>
  );
}
