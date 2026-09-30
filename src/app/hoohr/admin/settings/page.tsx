import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { getCompanyTimezone } from "@/lib/company";
import { currencyOptions } from "@/lib/company-defaults";
import { zonedToday } from "@/lib/attendance";
import { formatLeaveDay } from "@/lib/leave";
import { getDict, getLocale, interpolate, INTL_LOCALES } from "@/i18n/server";
import { SettingsClient, type PolicyView, type CategoryView, type HolidayView } from "./settings-client";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getDict();
  return { title: settings.page.title };
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();
  const locale = await getLocale();
  const intl = INTL_LOCALES[locale];
  const tz = await getCompanyTimezone(admin.companyId);
  const currentYear = zonedToday(tz).getUTCFullYear();

  const params = await searchParams;
  const requestedYear = Number(params.year);
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : currentYear;

  const [company, policies, holidays, categories] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: admin.companyId },
      select: {
        name: true,
        timezone: true,
        currency: true,
        weekendDays: true,
      },
    }),
    prisma.leavePolicy.findMany({
      where: { companyId: admin.companyId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { _count: { select: { balances: true } } },
    }),
    prisma.holiday.findMany({
      where: { companyId: admin.companyId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, name: true },
    }),
    prisma.expenseCategory.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const policyViews: PolicyView[] = policies.map((policy) => ({
    id: policy.id,
    name: policy.name,
    kind: policy.kind,
    kindLabel: common.leaveKind[policy.kind] ?? policy.kind,
    annualDays: policy.annualDays,
    maxCarryOverDays: policy.maxCarryOverDays,
    isPaid: policy.isPaid,
    requiresApproval: policy.requiresApproval,
    active: policy.active,
    balanceCount: policy._count.balances,
  }));

  const holidayViews: HolidayView[] = holidays.map((holiday) => ({
    id: holiday.id,
    date: toDateInput(holiday.date),
    label: interpolate(settings.item.holidayLabel, {
      date: formatLeaveDay(holiday.date, intl),
      name: holiday.name,
    }),
    year: holiday.date.getUTCFullYear(),
    name: holiday.name,
  }));

  const categoryViews: CategoryView[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    itemCount: category._count.items,
  }));

  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{settings.page.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{settings.page.subtitle}</p>
      </div>

      <SettingsClient
        companyName={company.name}
        timezone={company.timezone}
        timezones={Intl.supportedValuesOf("timeZone")}
        currency={company.currency}
        currencies={currencyOptions()}
        weekendDays={company.weekendDays}
        currentYear={currentYear}
        year={year}
        prevYear={prevYear}
        nextYear={nextYear}
        policies={policyViews}
        holidays={holidayViews}
        categories={categoryViews}
      />
    </div>
  );
}
