import type { Metadata } from "next";
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
  const { common, dashboard } = await getDict();
  const locale = INTL_LOCALES[await getLocale()];
  const now = new Date();
  const year = now.getUTCFullYear();

  const [
    employee,
    ptoBalance,
    pendingLeave,
    pendingExpense,
  ] = await Promise.all([
    user.employeeId
      ? prisma.employee.findUnique({
          where: { id: user.employeeId },
          include: { department: true },
        })
      : null,
    user.employeeId
      ? prisma.leaveBalance.findFirst({
          where: {
            employeeId: user.employeeId,
            year,
            policy: { kind: "PTO" },
          },
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

  const ptoRemaining = ptoBalance
    ? ptoBalance.grantedDays - ptoBalance.usedDays + ptoBalance.adjustDays
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        {interpolate(dashboard.greeting, { name: user.name })}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {interpolate(dashboard.profile, {
          department: employee?.department?.name ?? "-",
          position: employee?.position ?? "-",
          date: formatDate(employee?.hireDate ?? null, locale),
        })}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={dashboard.stats.ptoRemaining}
          value={
            ptoRemaining !== null
              ? interpolate(common.units.days, { n: ptoRemaining })
              : "-"
          }
          sub={interpolate(dashboard.stats.ptoGrantedUsed, {
            granted: ptoBalance?.grantedDays ?? 0,
            used: ptoBalance?.usedDays ?? 0,
          })}
        />
        <StatCard
          title={dashboard.stats.pendingLeave}
          value={interpolate(common.units.count, { n: pendingLeave })}
          sub={dashboard.stats.myRequests}
        />
        <StatCard
          title={dashboard.stats.submittedExpenses}
          value={interpolate(common.units.count, { n: pendingExpense })}
          sub={dashboard.stats.awaitingPayment}
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">{dashboard.next.title}</h2>
        <p className="mt-2 text-sm text-zinc-600">{dashboard.next.body}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}
