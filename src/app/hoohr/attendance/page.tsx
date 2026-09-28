import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  approvalInboxEmployeeWhere,
  isApprovalReviewer,
  teamEmployeeWhere,
} from "@/lib/team";
import {
  addMonths,
  formatDate,
  formatDayWithWeekday,
  formatDuration,
  formatTime,
  isOpenSegment,
  monthBounds,
  monthLabel,
  workedMs,
  zonedDateString,
  zonedToday,
} from "@/lib/attendance";
import type { CommonMessages } from "@/i18n/dictionaries/common";
import { getDict, getLocale, interpolate, INTL_LOCALES } from "@/i18n/server";
import { TodayPanel, type AttendanceEventItem } from "./today-panel";
import { CorrectionForm } from "./correction-form";
import { DecideForm } from "./decide-form";

export async function generateMetadata(): Promise<Metadata> {
  const { attendance } = await getDict();
  return { title: attendance.page.title };
}

function statusBadge(
  status: string,
  labels: CommonMessages["correctionStatus"],
) {
  const color =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {labels[status as keyof CommonMessages["correctionStatus"]] ?? status}
    </span>
  );
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { common, attendance } = await getDict();
  const locale = await getLocale();
  const intl = INTL_LOCALES[locale];
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { timezone: true },
  });
  const tz = company?.timezone ?? "UTC";

  const today = zonedToday(tz);
  const now = new Date();
  const todayStr = zonedDateString(now, tz);
  const todayWeekday = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: "short",
    timeZone: tz,
  }).format(now);
  const todayLabel = interpolate(attendance.today.dateLabel, {
    date: todayStr,
    weekday: todayWeekday,
  });

  const params = await searchParams;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(params.month ?? "");
  let monthDate = today;
  if (monthMatch) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    if (m >= 1 && m <= 12) monthDate = new Date(Date.UTC(y, m - 1, 1));
  }
  const { start, end } = monthBounds(monthDate);
  const prevHref = `/hoohr/attendance?month=${monthLabel(addMonths(monthDate, -1))}`;
  const nextHref = `/hoohr/attendance?month=${monthLabel(addMonths(monthDate, 1))}`;

  const isReviewer = isApprovalReviewer(user);
  const teamScope = isReviewer
    ? teamEmployeeWhere(user, true)
    : { id: { in: [] } };

  const [
    myEmployee,
    myToday,
    monthRecords,
    myCorrections,
    inbox,
    teamEmployees,
    teamToday,
  ] = await Promise.all([
    user.employeeId
      ? prisma.employee.findUnique({
          where: { id: user.employeeId },
          include: { department: true },
        })
      : Promise.resolve(null),
    user.employeeId
      ? prisma.attendanceRecord.findUnique({
          where: {
            employeeId_date: { employeeId: user.employeeId, date: today },
          },
          include: { events: { orderBy: { at: "asc" } } },
        })
      : Promise.resolve(null),
    user.employeeId
      ? prisma.attendanceRecord.findMany({
          where: {
            companyId: user.companyId,
            employeeId: user.employeeId,
            date: { gte: start, lt: end },
          },
          include: {
            events: { orderBy: { at: "asc" } },
            corrections: {
              select: { id: true, status: true, requestType: true },
            },
          },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
    user.employeeId
      ? prisma.attendanceCorrection.findMany({
          where: {
            companyId: user.companyId,
            employeeId: user.employeeId,
          },
          include: { decidedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    isReviewer
      ? prisma.attendanceCorrection.findMany({
          where: {
            companyId: user.companyId,
            status: "PENDING",
            employee: approvalInboxEmployeeWhere(user),
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    isReviewer
      ? prisma.employee.findMany({
          where: { ...teamScope, status: "ACTIVE" },
          include: { department: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isReviewer
      ? prisma.attendanceRecord.findMany({
          where: {
            companyId: user.companyId,
            date: today,
            employee: { ...teamScope, status: "ACTIVE" },
          },
          include: {
            employee: { select: { id: true, name: true } },
            events: { orderBy: { at: "asc" } },
          },
        })
      : Promise.resolve([]),
  ]);

  const myEvents: AttendanceEventItem[] = (myToday?.events ?? []).map((e) => ({
    kind: e.kind,
    time: formatTime(e.at, tz, intl),
  }));
  const myWorked = workedMs(myToday?.events ?? []);
  const myOpen = isOpenSegment(myToday?.events ?? []);

  const teamRecordMap = new Map(
    teamToday.map((r) => [r.employeeId, r] as const),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {attendance.page.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {myEmployee?.department?.name ?? "-"} · {myEmployee?.position ?? "-"}
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={prevHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            {attendance.sections.prevMonth}
          </Link>
          <span className="px-3 font-medium text-zinc-800">
            {monthLabel(monthDate)}
          </span>
          <Link
            href={nextHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            {attendance.sections.nextMonth}
          </Link>
        </nav>
      </div>

      {user.employeeId && (
        <TodayPanel
          todayLabel={todayLabel}
          open={myOpen}
          checkInAt={formatTime(myToday?.checkInAt ?? null, tz, intl)}
          checkOutAt={formatTime(myToday?.checkOutAt ?? null, tz, intl)}
          worked={formatDuration(myWorked, intl)}
          events={myEvents}
        />
      )}

      {user.employeeId && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {interpolate(attendance.records.heading, {
              month: monthLabel(monthDate),
            })}
          </h2>
          {monthRecords.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              {attendance.records.empty}
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="pb-2 font-medium">{common.fields.date}</th>
                  <th className="pb-2 font-medium">{attendance.today.checkIn}</th>
                  <th className="pb-2 font-medium">{attendance.today.checkOut}</th>
                  <th className="pb-2 font-medium">{attendance.today.worked}</th>
                  <th className="pb-2 font-medium">{attendance.records.colCorrection}</th>
                </tr>
              </thead>
              <tbody>
                {monthRecords.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-2.5 text-zinc-700">
                      {formatDayWithWeekday(r.date, intl)}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(r.checkInAt, tz, intl)}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(r.checkOutAt, tz, intl)}
                    </td>
                    <td className="py-2.5 text-zinc-700">
                      {formatDuration(workedMs(r.events), intl)}
                    </td>
                    <td className="py-2.5">
                      {r.corrections[0]
                        ? statusBadge(r.corrections[0].status, common.correctionStatus)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {isReviewer && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {attendance.team.heading}
          </h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">{common.fields.name}</th>
                <th className="pb-2 font-medium">{common.fields.department}</th>
                <th className="pb-2 font-medium">{common.fields.status}</th>
                <th className="pb-2 font-medium">{attendance.today.checkIn}</th>
                <th className="pb-2 font-medium">{attendance.today.checkOut}</th>
              </tr>
            </thead>
            <tbody>
              {teamEmployees.map((emp) => {
                const rec = teamRecordMap.get(emp.id);
                const recOpen = rec ? isOpenSegment(rec.events) : false;
                return (
                  <tr key={emp.id} className="border-b border-zinc-100">
                    <td className="py-2.5 text-zinc-700">{emp.name}</td>
                    <td className="py-2.5 text-zinc-500">
                      {emp.department?.name ?? "-"}
                    </td>
                    <td className="py-2.5">
                      {!rec ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                          {attendance.team.notRecorded}
                        </span>
                      ) : recOpen ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                          {attendance.today.onWork}
                        </span>
                      ) : (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          {attendance.today.checkOut}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(rec?.checkInAt ?? null, tz, intl)}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(rec?.checkOutAt ?? null, tz, intl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {user.employeeId && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                {attendance.corrections.heading}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {attendance.corrections.subtitle}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <CorrectionForm today={todayStr} />
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-4">
            <p className="mb-3 text-sm font-semibold text-zinc-700">
              {attendance.corrections.myRequests}
            </p>
            {myCorrections.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {attendance.corrections.noRequests}
              </p>
            ) : (
              <ul className="space-y-2">
                {myCorrections.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-zinc-800">
                      {formatDate(c.date, intl)}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                      {attendance.requestType[
                        c.requestType as keyof typeof attendance.requestType
                      ] ?? c.requestType}
                    </span>
                    {statusBadge(c.status, common.correctionStatus)}
                    <span className="flex-1 text-zinc-500">{c.note}</span>
                    {c.comment && (
                      <span className="w-full text-xs text-zinc-400">
                        {c.decidedBy
                          ? interpolate(
                              attendance.corrections.commentWithAuthor,
                              { comment: c.comment, name: c.decidedBy.name },
                            )
                          : interpolate(attendance.corrections.comment, {
                              comment: c.comment,
                            })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {interpolate(attendance.corrections.inbox, {
              count: inbox.length,
            })}
          </h2>
          <ul className="mt-4 space-y-3">
            {inbox.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">
                    {c.employee.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {c.employee.department?.name ?? "-"}
                  </span>
                  <span className="text-zinc-500">·</span>
                  <span className="font-medium">{formatDate(c.date, intl)}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {attendance.requestType[
                        c.requestType as keyof typeof attendance.requestType
                      ] ?? c.requestType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{c.note}</p>
                <DecideForm correctionId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}