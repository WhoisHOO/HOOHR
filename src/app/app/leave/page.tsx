import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getCompanyTimezone } from "@/lib/company";
import { addMonths, monthBounds, monthLabel, zonedToday } from "@/lib/attendance";
import { formatLeaveRange, remainingDays } from "@/lib/leave";
import { LeaveRequestForm, type LeavePolicyOption } from "./leave-form";
import { DecideLeaveForm } from "./decide-form";
import { CancelLeaveButton } from "./cancel-button";

export const metadata: Metadata = {
  title: "휴가",
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  CANCELED: "취소됨",
};

function statusBadge(status: string) {
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
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const tz = await getCompanyTimezone(user.companyId);

  const today = zonedToday(tz);
  const year = today.getUTCFullYear();

  const params = await searchParams;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(params.month ?? "");
  let monthDate = today;
  if (monthMatch) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    if (m >= 1 && m <= 12) monthDate = new Date(Date.UTC(y, m - 1, 1));
  }
  const { start: monthStart, end: monthEnd } = monthBounds(monthDate);
  const prevHref = `/app/leave?month=${monthLabel(addMonths(monthDate, -1))}`;
  const nextHref = `/app/leave?month=${monthLabel(addMonths(monthDate, 1))}`;

  const isReviewer = user.role === "MANAGER" || user.role === "ADMIN";

  const [policies, balances, myRequests, myMonthLeaves, inbox, companyMonthLeaves] =
    await Promise.all([
      prisma.leavePolicy.findMany({
        where: { companyId: user.companyId, active: true },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      }),
      user.employeeId
        ? prisma.leaveBalance.findMany({ where: { employeeId: user.employeeId, year } })
        : Promise.resolve([]),
      user.employeeId
        ? prisma.leaveRequest.findMany({
            where: { employeeId: user.employeeId },
            include: { policy: true, decidedBy: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      user.employeeId
        ? prisma.leaveRequest.findMany({
            where: {
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
            where: { companyId: user.companyId, status: "PENDING" },
            include: {
              policy: true,
              employee: { include: { department: { select: { name: true } } } },
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

  const balanceByPolicy = new Map(balances.map((b) => [b.policyId, b]));

  const policyOptions: LeavePolicyOption[] = policies.map((p) => {
    const bal = balanceByPolicy.get(p.id);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      remaining:
        p.kind === "UNPAID" ? null : bal ? remainingDays(bal) : 0,
    };
  });

  const monthLeaves = isReviewer ? companyMonthLeaves : myMonthLeaves;

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900">휴가</h1>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          계정에 직원 정보가 연결되어 있지 않습니다. 관리자에게 문의하세요.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">휴가</h1>
        <p className="mt-1 text-sm text-zinc-500">
          연차 · 병가 · 무급휴직 신청 및 승인
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {policies.map((p) => {
          const bal = balanceByPolicy.get(p.id);
          return (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <p className="text-xs font-medium text-zinc-500">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {p.kind === "UNPAID"
                  ? "-"
                  : `${bal ? Math.max(0, remainingDays(bal)) : 0}일`}
              </p>
              {bal && (
                <p className="mt-1 text-xs text-zinc-400">
                  부여 {bal.grantedDays} · 사용 {bal.usedDays} · 조정 {bal.adjustDays}
                </p>
              )}
              {!bal && p.kind !== "UNPAID" && (
                <p className="mt-1 text-xs text-zinc-400">잔여 없음</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">휴가 신청</h2>
            <p className="mt-1 text-xs text-zinc-500">
              주말은 제외하고 일수가 계산됩니다. 반차는 0.5일.
            </p>
          </div>
        </div>
        <div className="mt-4">
          {policyOptions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              등록된 휴가 정책이 없습니다. 관리자에게 문의하세요.
            </p>
          ) : (
            <LeaveRequestForm
              policies={policyOptions}
              today={`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">내 휴가 신청</h2>
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

        {myRequests.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">신청 내역이 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {myRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-4 py-3 text-sm"
              >
                <span className="font-medium text-zinc-800">{r.policy.name}</span>
                <span className="text-zinc-600">
                  {formatLeaveRange(r.startDate, r.endDate)}
                  {r.isHalfDay ? " (반차)" : ""}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                  {r.days}일
                </span>
                {statusBadge(r.status)}
                <span className="flex-1 truncate text-zinc-500">{r.reason ?? ""}</span>
                {r.status === "PENDING" && <CancelLeaveButton leaveId={r.id} />}
                <span className="w-full text-xs text-zinc-400">
                  {r.status !== "PENDING" &&
                    r.status !== "CANCELED" &&
                    r.decisionComment &&
                    `의견: ${r.decisionComment}${r.decidedBy ? ` (${r.decidedBy.name})` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {monthLabel(monthDate)} 휴가 일정
        </h2>
        {monthLeaves.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            이번 달 승인된 휴가가 없습니다.
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
                  {formatLeaveRange(r.startDate, r.endDate)}
                  {r.isHalfDay ? " (반차)" : ""}
                </span>
                <span className="ml-auto text-xs text-zinc-400">{r.days}일</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            승인 대기 휴가 요청 ({inbox.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {inbox.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="text-xs text-zinc-500">
                    {r.employee.department?.name ?? "-"}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {r.policy.name}
                  </span>
                  <span className="text-zinc-600">
                    {formatLeaveRange(r.startDate, r.endDate)}
                    {r.isHalfDay ? " (반차)" : ""}
                  </span>
                  <span className="text-xs text-zinc-500">{r.days}일</span>
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