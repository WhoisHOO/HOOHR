import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getCompanyTimezone } from "@/lib/company";
import { zonedToday, monthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/expense";
import { formatLeaveRange } from "@/lib/leave";
import {
  approvalInboxEmployeeWhere,
  canActAsAdmin,
  isApprovalReviewer,
} from "@/lib/team";
import type { CommonMessages } from "@/i18n/dictionaries/common";
import { getDict, getLocale, interpolate, INTL_LOCALES } from "@/i18n/server";
import { NewExpenseForm, type ExpenseCategoryOption } from "./expense-form";
import { SubmitExpenseButton } from "./submit-button";
import { DeleteExpenseButton } from "./delete-button";
import { DecideExpenseForm } from "./decide-form";

export async function generateMetadata(): Promise<Metadata> {
  const { expenses } = await getDict();
  return { title: expenses.page.title };
}

function statusBadge(status: string, labels: CommonMessages["expenseStatus"]) {
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
      {labels[status as keyof CommonMessages["expenseStatus"]] ?? status}
    </span>
  );
}

function ItemRows({
  title,
  items,
  receiptLink,
  intl,
}: {
  title: string;
  receiptLink: (filename: string) => string;
  intl: string;
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
              {formatLeaveRange(it.date, it.date, intl)}
            </span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
              {it.category.name}
            </span>
            <span className="font-medium text-zinc-800">
              {formatMoney(it.amountCents, it.currency, intl)}
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
                {receiptLink(r.filename)}
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
  const { common, expenses } = await getDict();
  const locale = await getLocale();
  const intl = INTL_LOCALES[locale];
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

  const receiptLink = (filename: string) =>
    interpolate(expenses.receipt.link, { filename });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {expenses.page.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{expenses.page.subtitle}</p>
        <Link
          href={`/hoohr/expenses/export?month=${currentMonth}`}
          className="mt-3 inline-block rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          {expenses.page.exportCsv}
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {expenses.sections.newReport}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {expenses.sections.newReportHint}
        </p>
        <div className="mt-4">
          <NewExpenseForm categories={categoryOptions} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {expenses.sections.myReports}
        </h2>
        {myReports.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {expenses.sections.noReports}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {myReports.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  {statusBadge(r.status, common.expenseStatus)}
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd, intl)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency, intl)}
                  </span>
                </div>
                {r.items.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <ItemRows
                      title={expenses.sections.items}
                      receiptLink={receiptLink}
                    intl={intl}
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
                        {expenses.sections.noItemsCannotSubmit}
                      </span>
                    )}
                  </div>
                )}
                {r.status === "REJECTED" && r.comment && (
                  <p className="mt-2 text-xs text-red-600">
                    {interpolate(expenses.sections.rejectReason, {
                      comment: r.comment,
                    })}
                  </p>
                )}
                {!["DRAFT", "REJECTED"].includes(r.status) && r.comment && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {interpolate(expenses.sections.comment, {
                      comment: r.comment,
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isReviewer && inbox.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {interpolate(expenses.sections.inbox, { count: inbox.length })}
          </h2>
          <ul className="mt-4 space-y-3">
            {inbox.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd, intl)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency, intl)}
                  </span>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <ItemRows
                    title={expenses.sections.items}
                    receiptLink={receiptLink}
                    intl={intl}
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
            {interpolate(expenses.sections.payQueue, { count: payQueue.length })}
          </h2>
          <ul className="mt-4 space-y-3">
            {payQueue.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">{r.employee.name}</span>
                  <span className="font-medium text-zinc-800">{r.title}</span>
                  <span className="text-xs text-zinc-500">
                    {formatLeaveRange(r.periodStart, r.periodEnd, intl)}
                  </span>
                  <span className="ml-auto font-semibold text-zinc-900">
                    {formatMoney(r.totalAmountCents, r.currency, intl)}
                  </span>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <ItemRows
                    title={expenses.sections.items}
                    receiptLink={receiptLink}
                    intl={intl}
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