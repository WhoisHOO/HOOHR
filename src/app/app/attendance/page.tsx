import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
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
import { TodayPanel, type AttendanceEventItem } from "./today-panel";
import { CorrectionForm } from "./correction-form";
import { DecideForm } from "./decide-form";

export const metadata: Metadata = {
  title: "근태",
};

const CORRECTION_TYPE_LABELS: Record<string, string> = {
  ADD: "기록 누락",
  EDIT: "시간 수정",
  FIX: "기록 오류",
};

const CORRECTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
};

function statusBadge(status: string) {
  const color =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {CORRECTION_STATUS_LABELS[status]}
    </span>
  );
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { timezone: true },
  });
  const tz = company?.timezone ?? "UTC";

  const today = zonedToday(tz);
  const now = new Date();
  const todayStr = zonedDateString(now, tz);
  const todayWeekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: tz,
  }).format(now);
  const todayLabel = `${todayStr} (${todayWeekday})`;

  const params = await searchParams;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(params.month ?? "");
  let monthDate = today;
  if (monthMatch) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    if (m >= 1 && m <= 12) monthDate = new Date(Date.UTC(y, m - 1, 1));
  }
  const { start, end } = monthBounds(monthDate);
  const prevHref = `/app/attendance?month=${monthLabel(addMonths(monthDate, -1))}`;
  const nextHref = `/app/attendance?month=${monthLabel(addMonths(monthDate, 1))}`;

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900">근태</h1>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          계정에 직원 정보가 연결되어 있지 않습니다. 관리자에게 문의하세요.
        </div>
      </div>
    );
  }

  const isReviewer = user.role === "MANAGER" || user.role === "ADMIN";

  const [
    myEmployee,
    myToday,
    monthRecords,
    myCorrections,
    inbox,
    teamEmployees,
    teamToday,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { department: true },
    }),
    prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: user.employeeId, date: today } },
      include: { events: { orderBy: { at: "asc" } } },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: user.employeeId,
        date: { gte: start, lt: end },
      },
      include: {
        events: { orderBy: { at: "asc" } },
        corrections: { select: { id: true, status: true, requestType: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.attendanceCorrection.findMany({
      where: { employeeId: user.employeeId },
      include: { decidedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    isReviewer
      ? prisma.attendanceCorrection.findMany({
          where: { companyId: user.companyId, status: "PENDING" },
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
          where: { companyId: user.companyId, status: "ACTIVE" },
          include: { department: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isReviewer
      ? prisma.attendanceRecord.findMany({
          where: {
            companyId: user.companyId,
            date: today,
            employee: { status: "ACTIVE" },
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
    time: formatTime(e.at, tz),
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
          <h1 className="text-2xl font-semibold text-zinc-900">근태</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {myEmployee?.department?.name ?? "-"} · {myEmployee?.position ?? "-"}
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={prevHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            이전달
          </Link>
          <span className="px-3 font-medium text-zinc-800">
            {monthLabel(monthDate)}
          </span>
          <Link
            href={nextHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            다음달
          </Link>
        </nav>
      </div>

      <TodayPanel
        todayLabel={todayLabel}
        open={myOpen}
        checkInAt={formatTime(myToday?.checkInAt ?? null, tz)}
        checkOutAt={formatTime(myToday?.checkOutAt ?? null, tz)}
        worked={formatDuration(myWorked)}
        events={myEvents}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {monthLabel(monthDate)} 출근 기록
        </h2>
        {monthRecords.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            이번 달 기록이 없습니다.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">날짜</th>
                <th className="pb-2 font-medium">출근</th>
                <th className="pb-2 font-medium">퇴근</th>
                <th className="pb-2 font-medium">근무</th>
                <th className="pb-2 font-medium">정정</th>
              </tr>
            </thead>
            <tbody>
              {monthRecords.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="py-2.5 text-zinc-700">
                    {formatDayWithWeekday(r.date)}
                  </td>
                  <td className="py-2.5 tabular-nums text-zinc-700">
                    {formatTime(r.checkInAt, tz)}
                  </td>
                  <td className="py-2.5 tabular-nums text-zinc-700">
                    {formatTime(r.checkOutAt, tz)}
                  </td>
                  <td className="py-2.5 text-zinc-700">
                    {formatDuration(workedMs(r.events))}
                  </td>
                  <td className="py-2.5">
                    {r.corrections[0]
                      ? statusBadge(r.corrections[0].status)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isReviewer && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            팀 근태 현황 · 오늘
          </h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">이름</th>
                <th className="pb-2 font-medium">부서</th>
                <th className="pb-2 font-medium">상태</th>
                <th className="pb-2 font-medium">출근</th>
                <th className="pb-2 font-medium">퇴근</th>
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
                          미기록
                        </span>
                      ) : recOpen ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                          근무 중
                        </span>
                      ) : (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          퇴근
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(rec?.checkInAt ?? null, tz)}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-700">
                      {formatTime(rec?.checkOutAt ?? null, tz)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">근태 정정 신청</h2>
            <p className="mt-1 text-xs text-zinc-500">
              기록 누락/오류 시 신청하고 관리자 승인을 받습니다.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <CorrectionForm today={todayStr} />
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-4">
          <p className="mb-3 text-sm font-semibold text-zinc-700">내 정정 요청</p>
          {myCorrections.length === 0 ? (
            <p className="text-sm text-zinc-500">정정 요청 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {myCorrections.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-zinc-800">
                    {formatDate(c.date)}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {CORRECTION_TYPE_LABELS[c.requestType] ?? c.requestType}
                  </span>
                  {statusBadge(c.status)}
                  <span className="flex-1 text-zinc-500">{c.note}</span>
                  {c.comment && (
                    <span className="w-full text-xs text-zinc-400">
                      의견: {c.comment}
                      {c.decidedBy ? ` (${c.decidedBy.name})` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            승인 대기 정정 요청 ({inbox.length})
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
                  <span className="font-medium">{formatDate(c.date)}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {CORRECTION_TYPE_LABELS[c.requestType] ?? c.requestType}
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