import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "대시보드",
};

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function formatTime(d: Date | null, timeZone: string): string | null {
  if (!d) return null;
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const year = now.getUTCFullYear();

  const [
    company,
    employee,
    ptoBalance,
    todayAttendance,
    pendingLeave,
    pendingExpense,
  ] = await Promise.all([
    prisma.company.findUnique({ where: { id: user.companyId } }),
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
      ? prisma.attendanceRecord.findUnique({
          where: {
            employeeId_date: {
              employeeId: user.employeeId,
              date: now,
            },
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

  const tz = company?.timezone ?? "UTC";
  const ptoRemaining = ptoBalance
    ? ptoBalance.grantedDays - ptoBalance.usedDays + ptoBalance.adjustDays
    : null;

  const checkInTime = formatTime(todayAttendance?.checkInAt ?? null, tz);
  const checkOutTime = formatTime(todayAttendance?.checkOutAt ?? null, tz);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        안녕하세요, {user.name}님
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {employee?.department?.name ?? "-"} · {employee?.position ?? "-"} · 입사{" "}
        {formatDate(employee?.hireDate ?? null)}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="연차 잔여"
          value={ptoRemaining !== null ? `${ptoRemaining}일` : "-"}
          sub={`발생 ${ptoBalance?.grantedDays ?? 0}일 · 사용 ${ptoBalance?.usedDays ?? 0}일`}
        />
        <StatCard
          title="오늘 근태"
          value={checkInTime ? `체크인 ${checkInTime}` : "미기록"}
          sub={checkOutTime ? `체크아웃 ${checkOutTime}` : "체크아웃 전"}
        />
        <StatCard title="승인 대기 휴가" value={`${pendingLeave}건`} sub="본인 신청" />
        <StatCard title="제출 경비" value={`${pendingExpense}건`} sub="결제 대기" />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">다음 단계</h2>
        <p className="mt-2 text-sm text-zinc-600">
          근태 · 휴가 · 경비 모듈이 모두 열렸습니다. 이제 출근 체크, 휴가 신청,
          경비 정산을 이용할 수 있습니다.
        </p>
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
