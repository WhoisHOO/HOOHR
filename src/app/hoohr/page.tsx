import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getDict, getLocale, interpolate, INTL_LOCALES } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dashboard } = await getDict();
  return { title: dashboard.page.title };
}

function formatDate(d: Date | null, locale: string): string {
  if (!d) return "-";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { dashboard } = await getDict();
  const locale = INTL_LOCALES[await getLocale()];
  const now = new Date();
  const year = now.getUTCFullYear();
  const isAdmin = user.role === "ADMIN";

  const [employee, ptoPolicy, ptoUsed, pendingLeave, submittedExpense] =
    await Promise.all([
      user.employeeId
        ? prisma.employee.findUnique({
            where: { id: user.employeeId },
          })
        : null,
      user.employeeId
        ? prisma.leavePolicy.findFirst({
            where: { companyId: user.companyId, active: true, kind: "PTO" },
          })
        : null,
      user.employeeId
        ? prisma.leaveRequest.aggregate({
            where: {
              employeeId: user.employeeId,
              status: "APPROVED",
              startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
              endDate: { lte: new Date(Date.UTC(year, 11, 31)) },
              policy: { kind: "PTO" },
            },
            _sum: { days: true },
          })
        : null,
      user.employeeId
        ? prisma.leaveRequest.count({
            where: { employeeId: user.employeeId, status: "PENDING" },
          })
        : 0,
      user.employeeId
        ? prisma.expenseReport.count({
            where: { employeeId: user.employeeId, status: "SUBMITTED" },
          })
        : 0,
    ]);

  const ptoRemaining = ptoPolicy
    ? Math.max(0, ptoPolicy.annualDays - (ptoUsed?._sum.days ?? 0))
    : null;

  // Admin sees everyone else's waiting requests. Employees never see this.
  const [inboxLeave, inboxExpense, employeeCount] = isAdmin
    ? await Promise.all([
        prisma.leaveRequest.count({
          where: {
            companyId: user.companyId,
            status: "PENDING",
            employeeId: { not: user.employeeId ?? "" },
          },
        }),
        prisma.expenseReport.count({
          where: {
            companyId: user.companyId,
            status: "SUBMITTED",
            employeeId: { not: user.employeeId ?? "" },
          },
        }),
        prisma.employee.count({ where: { companyId: user.companyId } }),
      ])
    : [0, 0, 0];

  const isFreshInstall = isAdmin && employeeCount <= 1;

  // ---- 직원: 딱 두 개의 행동만. ----
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {interpolate(dashboard.greeting, { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {interpolate(dashboard.profile, {
            position: employee?.position ?? "-",
            date: formatDate(employee?.hireDate ?? null, locale),
          })}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/hoohr/leave"
            className="block rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <p className="text-base font-semibold text-zinc-900">
              {dashboard.myActions.leaveTitle}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {dashboard.myActions.leaveHint}
            </p>
            <p className="mt-3 text-sm font-medium text-blue-700">
              {interpolate(dashboard.myActions.pendingLeave, { n: pendingLeave })}
            </p>
          </Link>
          <Link
            href="/hoohr/expenses"
            className="block rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <p className="text-base font-semibold text-zinc-900">
              {dashboard.myActions.expenseTitle}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {dashboard.myActions.expenseHint}
            </p>
            <p className="mt-3 text-sm font-medium text-blue-700">
              {interpolate(dashboard.myActions.pendingExpense, { n: submittedExpense })}
            </p>
          </Link>
        </div>

        {ptoRemaining !== null && (
          <p className="mt-6 text-sm text-zinc-500">
            {interpolate(dashboard.stats.leave.days, { n: ptoRemaining })}
          </p>
        )}
      </div>
    );
  }

  // ---- 관리자: 남은 일은 승인뿐이다. ----
  return (
    <div className="mx-auto max-w-4xl">
      {isFreshInstall && (
        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-sm font-semibold text-blue-900">
            {dashboard.gettingStarted.title}
          </h2>
          <p className="mt-1 text-xs text-blue-700">
            {dashboard.gettingStarted.subtitle}
          </p>
          <div className="mt-3">
            <Link
              href="/hoohr/admin/invite"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {dashboard.gettingStarted.action} →
            </Link>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-semibold text-zinc-900">
        {interpolate(dashboard.greeting, { name: user.name })}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {interpolate(dashboard.profile, {
          position: employee?.position ?? "-",
          date: formatDate(employee?.hireDate ?? null, locale),
        })}
      </p>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {dashboard.queue.title}
        </h2>
        {inboxLeave === 0 && inboxExpense === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">{dashboard.queue.empty}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link
              href="/hoohr/leave"
              className="block rounded-lg border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
            >
              <p className="text-2xl font-semibold text-zinc-900">
                {interpolate(dashboard.queue.leavePending, { n: inboxLeave })}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{dashboard.stats.leave.title}</p>
            </Link>
            <Link
              href="/hoohr/expenses"
              className="block rounded-lg border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
            >
              <p className="text-2xl font-semibold text-zinc-900">
                {interpolate(dashboard.queue.expensePending, { n: inboxExpense })}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{dashboard.stats.expenses.title}</p>
            </Link>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          href="/hoohr/leave"
          title={dashboard.stats.leave.title}
          value={
            ptoRemaining !== null
              ? interpolate(dashboard.stats.leave.days, { n: ptoRemaining })
              : "-"
          }
          sub={interpolate(dashboard.stats.leave.pending, { n: pendingLeave })}
        />
        <StatCard
          href="/hoohr/expenses"
          title={dashboard.stats.expenses.title}
          value={interpolate(dashboard.stats.expenses.claims, {
            n: submittedExpense,
          })}
          sub={dashboard.stats.expenses.awaiting}
        />
      </div>
    </div>
  );
}

function StatCard({
  href,
  title,
  value,
  sub,
}: {
  href: string;
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </Link>
  );
}
