import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getCompanyTimezone } from "@/lib/company";
import { zonedToday, monthLabel } from "@/lib/attendance";
import { formatMoney } from "@/lib/expense";
import { formatLeaveRange } from "@/lib/leave";
import {
  approvalInboxEmployeeWhere,
  canActAsAdmin,
  isApprovalReviewer,
} from "@/lib/team";
import { NewExpenseForm, type ExpenseCategoryOption } from "./expense-form";
import { SubmitExpenseButton } from "./submit-button";
import { DeleteExpenseButton } from "./delete-button";
import { DecideExpenseForm } from "./decide-form";

export const metadata: Metadata = {
  title: "경비",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "승인 대기",
  APPROVED: "승인됨",
  PAID: "지급 완료",
  REJECTED: "반려",
};

function statusBadge(status: string) {
  const color =
    status === "PAID"
      ? "bg-green-100 text-green-700"
      : status === "APPROVED"
        ? "bg-blue-100 text-blue-700"
        : status === "REJECTED"
          ? "bg-red-100 text-red-700"
          : status === "SUBMITTED"
            ? "bg-amber-100 text-amber-700"
            : "bg-zinc-200 text-zinc-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function ItemRows({
  title,
  items,
}: {
  title: string;
  items: {
    date: Date;
    category: { name: string };
    amountCents: number;
    description: string | null;
    currency: string;
    receipts: { id: string; filename: string; storedPath: string }[];
  }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title} ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li
            key={`${it.date.getTime()}-${it.category.name}`}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="text-xs text-zinc-500">
              {formatLeaveRange(it.date, it.date)}
            </span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
              {it.category.name}
            </span>
            <span className="font-medium text-zinc-800">
              {formatMoney(it.amountCents, it.currency)}
            </span>
            <span className="text-zinc-500">{it.description ?? ""}</span>
            {it.receipts.map((r) => (
              <a
                key={r.id}
                href={`/hoohr/files/${r.storedPath}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-600 underline hover:text-blue-800"
              >
                영수증: {r.filename}
              </a>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ExpensesPage() {
  const user = await requireUser();
  const isReviewer = isApprovalReviewer(user);
  const canPay = canActAsAdmin(user);
  const tz = await getCompanyTimezone(user.companyId);
  const currentMonth = monthLabel(zonedToday(tz));

  const [categories, myReports, inbox, payQueue] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: { name: "asc" },
    }),
    user.employeeId
      ? prisma.expenseReport.findMany({
          where: { companyId: user.companyId, employeeId: user.employeeId },
          include: {
            items: { include: { category: true, receipts: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    isReviewer
      ? prisma.expenseReport.findMany({
          where: {
            companyId: user.companyId,
            status: "SUBMITTED",
            employee: approvalInboxEmployeeWhere(user),
          },
          include: {
            employee: true,
            items: { include: { category: true, receipts: true } },
          },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    canPay
      ? prisma.expenseReport.findMany({
          where: {
            companyId: user.companyId,
            status: "APPROVED",
            employee: { companyId: user.companyId },
          },
          include: {
            employee: true,
            items: { include: { category: true, receipts: true } },
          },
          orderBy: { decidedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const categoryOptions: ExpenseCategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">경비</h1>
        <p className="mt-1 text-sm text-zinc-500">
          비용 신청서 작성 · 승인 · 지급 확인
        </p>
        <Link
          href={`/hoohr/expenses/export?month=${currentMonth}`}
          className="mt-3 inline-block rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          이번 달 CSV 내보내기
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">새 경비 신청서</h2>
        <p className="mt-1 text-xs text-zinc-500">
          제출 전까지 수정·삭제가 가능합니다. 제출 후 승인/반려 처리됩니다.
        </p>
        <div className="mt-4">
          <NewExpenseForm categories={categoryOptions} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">내 경비 신청서</h2>
        {myReports.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">신청 내역이 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {myReports.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  {statusBadge(r.status)}
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency)}
                  </span>
                </div>
                {r.items.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <ItemRows
                      title="항목"
                      items={r.items.map((it) => ({
                        ...it,
                        currency: r.currency,
                      }))}
                    />
                  </div>
                )}
                {r.status === "DRAFT" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
                    <SubmitExpenseButton reportId={r.id} disabled={r.items.length === 0} />
                    <DeleteExpenseButton reportId={r.id} />
                    {r.items.length === 0 && (
                      <span className="text-xs text-zinc-400">
                        항목이 없으면 제출할 수 없습니다.
                      </span>
                    )}
                  </div>
                )}
                {r.status === "REJECTED" && r.comment && (
                  <p className="mt-2 text-xs text-red-600">반려 사유: {r.comment}</p>
                )}
                {!["DRAFT", "REJECTED"].includes(r.status) && r.comment && (
                  <p className="mt-2 text-xs text-zinc-500">의견: {r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            승인 대기 경비 ({inbox.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {inbox.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency)}
                  </span>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <ItemRows
                    title="항목"
                    items={r.items.map((it) => ({ ...it, currency: r.currency }))}
                  />
                </div>
                <DecideExpenseForm reportId={r.id} mode="approve" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {canPay && payQueue.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            지급 대기 (승인됨) ({payQueue.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {payQueue.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency)}
                  </span>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <ItemRows
                    title="항목"
                    items={r.items.map((it) => ({ ...it, currency: r.currency }))}
                  />
                </div>
                <DecideExpenseForm reportId={r.id} mode="pay" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}