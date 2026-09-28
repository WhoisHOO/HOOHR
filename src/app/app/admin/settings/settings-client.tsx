"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  applyPolicyToCurrentYear,
  createExpenseCategory,
  createHoliday,
  deleteExpenseCategory,
  deleteHoliday,
  updateCompanySettings,
  updateExpenseCategory,
  updateLeavePolicy,
} from "@/app/actions/settings";
import type { FieldErrors } from "@/lib/auth-validation";
import type {
  CompanySettingsState,
  ExpenseCategoryState,
  HolidayState,
  LeavePolicyState,
} from "@/lib/settings-validation";

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
  balanceCount: number;
};

export type HolidayView = {
  id: string;
  date: string;
  label: string;
  year: number;
  name: string;
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

function CompanyForm({ name, timezone, timezones }: CompanyFormProps) {
  const [state, action, pending] = useActionState<CompanySettingsState, FormData>(
    updateCompanySettings,
    undefined,
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="company-name" className="text-xs font-medium text-zinc-500">
          회사명
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
        <label htmlFor="company-timezone" className="text-xs font-medium text-zinc-500">
          시간대 (표시 기준)
        </label>
        <select
          id="company-timezone"
          name="timezone"
          defaultValue={timezone}
          className={inputClass}
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <FieldError state={state} name="timezone" />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <div className="sm:col-span-3">
        <Message state={state} />
      </div>
    </form>
  );
}

type CompanyFormProps = {
  name: string;
  timezone: string;
  timezones: string[];
};

function CompanySection(props: CompanyFormProps) {
  return (
    <Section
      title="회사 정보"
      description="회사명과 시간대를 지정합니다. 시간대는 근태·휴가 화면의 날짜 기준입니다."
    >
      <CompanyForm {...props} />
    </Section>
  );
}

// ---- SET-2 ----

function PolicyRow({ policy, currentYear }: { policy: PolicyView; currentYear: number }) {
  const [state, action, pending] = useActionState<LeavePolicyState, FormData>(
    updateLeavePolicy,
    undefined,
  );
  const [applyState, applyAction, applyPending] = useActionState<LeavePolicyState, FormData>(
    applyPolicyToCurrentYear,
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
            aria-label="정책명"
            className={`${inputClass} max-w-48`}
          />
          {!policy.active && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              비활성
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">연간 부여 일수</label>
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
            <label className="text-xs font-medium text-zinc-500">이월 한도</label>
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
            유급
          </label>
          <div className="flex flex-col gap-2 text-sm text-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="requiresApproval"
                defaultChecked={policy.requiresApproval}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              승인 필요
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={policy.active}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              사용 중
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "저장 중..." : "정책 저장"}
          </button>
          <span className="text-xs text-zinc-400">
            잔액 행 {policy.balanceCount}건
          </span>
          <Message state={state} />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <form action={applyAction}>
          <input type="hidden" name="id" value={policy.id} />
          <button type="submit" disabled={applyPending} className={secondaryButtonClass}>
            {applyPending ? "적용 중..." : `${currentYear}년 잔액에 부여일 반영`}
          </button>
        </form>
        <p className="text-xs text-zinc-500">
          기존 잔액 행의 부여 일수만 갱신합니다 (사용일·조정일 유지).
        </p>
        <Message state={applyState} />
      </div>
    </article>
  );
}

function PolicySection({ policies, currentYear }: { policies: PolicyView[]; currentYear: number }) {
  return (
    <Section
      title="휴가 정책"
      description="유형별 연간 부여 일수와 이월 한도를 관리합니다. 정책 값은 신청 가능 여부에, 부여일 반영은 잔액에 적용됩니다."
      count={`${policies.length}개`}
    >
      {policies.map((policy) => (
        <PolicyRow key={policy.id} policy={policy} currentYear={currentYear} />
      ))}
    </Section>
  );
}

// ---- SET-3 ----

function HolidayDeleteForm({ holiday }: { holiday: HolidayView }) {
  const [state, action, pending] = useActionState<HolidayState, FormData>(
    deleteHoliday,
    undefined,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={holiday.id} />
      <button
        type="submit"
        disabled={pending}
        className={dangerButtonClass}
        aria-label={`${holiday.name} 삭제`}
      >
        {pending ? "삭제 중..." : "삭제"}
      </button>
      <Message state={state} />
    </form>
  );
}

function HolidaySection({
  holidays,
  year,
  prevYear,
  nextYear,
  currentYear,
}: {
  holidays: HolidayView[];
  year: number;
  prevYear: number;
  nextYear: number;
  currentYear: number;
}) {
  const [createState, createAction, createPending] = useActionState<HolidayState, FormData>(
    createHoliday,
    undefined,
  );
  const yearHolidays = holidays.filter((holiday) => holiday.year === year);

  return (
    <Section
      title="공휴일"
      description="등록된 공휴일은 휴가 신청일수 계산에서 자동으로 제외됩니다."
      count={`${year}년 ${yearHolidays.length}개`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/app/admin/settings?year=${prevYear}`}
          className={secondaryButtonClass}
        >
          ← {prevYear}년
        </Link>
        <span className="font-medium text-zinc-800">{year}년</span>
        <Link
          href={`/app/admin/settings?year=${nextYear}`}
          className={secondaryButtonClass}
        >
          {nextYear}년 →
        </Link>
        {year !== currentYear && (
          <Link
            href="/app/admin/settings"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            올해로
          </Link>
        )}
      </div>

      <form action={createAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="holiday-date" className="text-xs font-medium text-zinc-500">
            날짜
          </label>
          <input
            id="holiday-date"
            name="date"
            type="date"
            required
            defaultValue={`${year}-01-01`}
            className={inputClass}
          />
          <FieldError state={createState} name="date" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="holiday-name" className="text-xs font-medium text-zinc-500">
            공휴일명
          </label>
          <input
            id="holiday-name"
            name="name"
            type="text"
            required
            placeholder="예: 설날 연휴"
            className={inputClass}
          />
          <FieldError state={createState} name="name" />
        </div>
        <button type="submit" disabled={createPending} className={primaryButtonClass}>
          {createPending ? "등록 중..." : "공휴일 등록"}
        </button>
        <div className="w-full sm:w-auto">
          <Message state={createState} />
        </div>
      </form>

      {yearHolidays.length === 0 ? (
        <p className="text-sm text-zinc-500">{year}년에 등록된 공휴일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {yearHolidays.map((holiday) => (
            <li
              key={holiday.id}
              className="flex flex-wrap items-center gap-3 py-2 text-sm text-zinc-700"
            >
              <span className="w-28 font-mono text-xs text-zinc-500">{holiday.date}</span>
              <span>{holiday.name}</span>
              <div className="ml-auto">
                <HolidayDeleteForm holiday={holiday} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---- SET-4 ----

function CategoryRow({ category }: { category: CategoryView }) {
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
          aria-label="분류명"
          className={`${inputClass} max-w-48`}
        />
        <label className="flex items-center gap-1 text-xs text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={category.active}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
          />
          사용 중
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>
      <span className="text-xs text-zinc-400">항목 {category.itemCount}건</span>
      {!category.active && (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
          비활성
        </span>
      )}
      <form action={deleteAction}>
        <input type="hidden" name="id" value={category.id} />
        <button
          type="submit"
          disabled={deletePending || category.itemCount > 0}
          title={category.itemCount > 0 ? "사용 중인 분류는 삭제할 수 없습니다" : undefined}
          className={dangerButtonClass}
        >
          {deletePending ? "삭제 중..." : "삭제"}
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
  const [state, action, pending] = useActionState<ExpenseCategoryState, FormData>(
    createExpenseCategory,
    undefined,
  );

  return (
    <Section
      title="경비 분류"
      description="경비 신청에서 사용할 분류입니다. 사용 중인 분류는 삭제 대신 비활성화합니다."
      count={`${categories.length}개`}
    >
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="category-name" className="text-xs font-medium text-zinc-500">
            새 분류명
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            placeholder="예: 교육비"
            className={inputClass}
          />
          <FieldError state={state} name="name" />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "추가 중..." : "분류 추가"}
        </button>
        <Message state={state} />
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 분류가 없습니다.</p>
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
  timezone,
  timezones,
  currentYear,
  year,
  prevYear,
  nextYear,
  policies,
  holidays,
  categories,
}: {
  companyName: string;
  timezone: string;
  timezones: string[];
  currentYear: number;
  year: number;
  prevYear: number;
  nextYear: number;
  policies: PolicyView[];
  holidays: HolidayView[];
  categories: CategoryView[];
}) {
  return (
    <div className="space-y-8">
      <CompanySection name={companyName} timezone={timezone} timezones={timezones} />
      <PolicySection policies={policies} currentYear={currentYear} />
      <HolidaySection
        holidays={holidays}
        year={year}
        prevYear={prevYear}
        nextYear={nextYear}
        currentYear={currentYear}
      />
      <CategorySection categories={categories} />
    </div>
  );
}
