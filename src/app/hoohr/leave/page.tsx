import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getCompanyTimezone, getCompanyWeekendRaw } from "@/lib/company";
import { addMonths, monthBounds, monthLabel, zonedToday } from "@/lib/date";
import { formatLeaveRange } from "@/lib/leave";
import { getDict, getLocale, interpolate, INTL_LOCALES } from "@/i18n/server";
import { LeaveRequestForm, type LeavePolicyOption } from "./leave-form";
import { DecideLeaveForm } from "./decide-form";
import { CancelLeaveButton } from "./cancel-button";

export async function generateMetadata(): Promise<Metadata> {
  const { leave } = await getDict();
  return { title: leave.page.title };
}

function statusBadge(status: string, label: string) {
  const color =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : status === "CANCELED"
          ? "bg-zinc-200 text-zinc-600"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { common, leave } = await getDict();
  const locale = await getLocale();
  const intl = INTL_LOCALES[locale];
  const statusLabels: Record<string, string> = {
    PENDING: common.leaveStatus.PENDING,
    APPROVED: common.leaveStatus.APPROVED,
    REJECTED: common.leaveStatus.REJECTED,
    CANCELED: common.leaveStatus.CANCELED,
  };
  const tz = await getCompanyTimezone(user.companyId);
  const weekendDays = await getCompanyWeekendRaw(user.companyId);

  const today = zonedToday(tz);

  const params = await searchParams;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(params.month ?? "");
  let monthDate = today;
  if (monthMatch) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    if (m >= 1 && m <= 12) monthDate = new Date(Date.UTC(y, m - 1, 1));
  }
  const { start: monthStart, end: monthEnd } = monthBounds(monthDate);
  const prevHref = `/hoohr/leave?month=${monthLabel(addMonths(monthDate, -1))}`;
  const nextHref = `/hoohr/leave?month=${monthLabel(addMonths(monthDate, 1))}`;

  const isReviewer = user.role === "ADMIN";

  const [policies, myRequests, myMonthLeaves, inbox, companyMonthLeaves] =
    await Promise.all([
      prisma.leavePolicy.findMany({
        where: { companyId: user.companyId, active: true, kind: { in: ["PTO", "SICK"] } },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      }),
      user.employeeId
        ? prisma.leaveRequest.findMany({
            where: {
              companyId: user.companyId,
              employeeId: user.employeeId,
            },
            include: { policy: true, decidedBy: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      user.employeeId
        ? prisma.leaveRequest.findMany({
            where: {
              companyId: user.companyId,
              employeeId: user.employeeId,
              status: "APPROVED",
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
            include: { policy: true, employee: { select: { name: true } } },
            orderBy: { startDate: "asc" },
          })
        : Promise.resolve([]),
      isReviewer
        ? prisma.leaveRequest.findMany({
            where: {
              companyId: user.companyId,
              status: "PENDING",
              employeeId: { not: user.employeeId ?? "" },
            },
            include: {
              policy: true,
              employee: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      isReviewer
        ? prisma.leaveRequest.findMany({
            where: {
              companyId: user.companyId,
              status: "APPROVED",
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
            include: { policy: true, employee: true },
            orderBy: { startDate: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const policyOptions: LeavePolicyOption[] = policies.map((p) => {
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
    };
  });

  const monthLeaves = isReviewer ? companyMonthLeaves : myMonthLeaves;
  const isoDay = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{leave.page.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{leave.page.subtitle}</p>
        {isReviewer && (
          <form
            method="get"
            action="/hoohr/leave/export"
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
              {leave.export.from}
              <input
                name="from"
                type="date"
                required
                defaultValue={isoDay(monthStart)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
              {leave.export.to}
              <input
                name="to"
                type="date"
                required
                defaultValue={isoDay(monthEnd)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
              />
            </label>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              {leave.export.download}
            </button>
          </form>
        )}
      </div>

      {user.employeeId && (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  {leave.sections.request}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {leave.sections.requestHint}
                </p>
              </div>
            </div>
            <div className="mt-4">
              {policyOptions.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {leave.sections.noPolicy}
                </p>
              ) : (
                <LeaveRequestForm
                  policies={policyOptions}
                  today={`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`}
                  weekendDays={weekendDays}
                />
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  {leave.sections.myRequests}
                </h2>
              </div>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href={prevHref}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
                >
                  {leave.sections.prevMonth}
                </Link>
                <span className="px-3 font-medium text-zinc-800">
                  {monthLabel(monthDate)}
                </span>
                <Link
                  href={nextHref}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
                >
                  {leave.sections.nextMonth}
                </Link>
              </nav>
            </div>

            {myRequests.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                {leave.sections.noRequests}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {myRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-zinc-800">{r.policy.name}</span>
                    <span className="text-zinc-600">
                      {formatLeaveRange(r.startDate, r.endDate, intl)}
                    </span>
                    {statusBadge(r.status, statusLabels[r.status])}
                    <span className="flex-1 truncate text-zinc-500">{r.reason ?? ""}</span>
                    {r.status === "PENDING" && <CancelLeaveButton leaveId={r.id} />}
                    <span className="w-full text-xs text-zinc-400">
                      {r.status !== "PENDING" &&
                        r.status !== "CANCELED" &&
                        r.decisionComment &&
                        interpolate(leave.item.comment, {
                          comment: r.decisionComment,
                        }) +
                          (r.decidedBy
                            ? ` (${r.decidedBy.name})`
                            : "")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {interpolate(leave.sections.schedule, { month: monthLabel(monthDate) })}
        </h2>
        {monthLeaves.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {leave.sections.noSchedule}
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {monthLeaves.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 border-b border-zinc-100 py-2 text-sm text-zinc-700"
              >
                {isReviewer && (
                  <span className="w-24 truncate font-medium text-zinc-800">
                    {r.employee.name}
                  </span>
                )}
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                  {r.policy.name}
                </span>
                <span className="text-zinc-600">
                  {formatLeaveRange(r.startDate, r.endDate, intl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {interpolate(leave.sections.inbox, { count: inbox.length })}
          </h2>
          <ul className="mt-4 space-y-3">
            {inbox.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {r.policy.name}
                  </span>
                  <span className="text-zinc-600">
                    {formatLeaveRange(r.startDate, r.endDate, intl)}
                  </span>
                </div>
                {r.reason && <p className="mt-1 text-sm text-zinc-600">{r.reason}</p>}
                <DecideLeaveForm leaveId={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}