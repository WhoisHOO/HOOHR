"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { parseIsoDate } from "@/lib/date";
import { parseAmountToCents } from "@/lib/expense";
import { getCompanyCurrency } from "@/lib/company";
import { removeReceipt, saveReceipt, type ReceiptError } from "@/lib/storage";
import {
  expenseItemFormSchema,
  expenseReportCreateSchema,
  MAX_EXPENSE_ITEMS,
  type ExpenseCreateState,
  type ExpenseDecideState,
  type ExpenseDeleteState,
  type ExpenseSubmitState,
} from "@/lib/expense-validation";
import { getDict, getLocale, interpolate } from "@/i18n/server";
import {
  adminRecipients,
  notifyExpenseDecision,
  notifyExpenseSubmitted,
  type ExpenseDecisionOutcome,
} from "@/lib/notifications";

/** The slice of a decided report the NOT-1 notice needs, captured in-transaction. */
type ExpenseDecisionMail = {
  to: string;
  requesterName: string;
  title: string;
  totalAmountCents: number;
  currency: string;
};
import type { ExpenseMessages } from "@/i18n/dictionaries/expenses";

type ItemInput = {
  date: Date;
  amountCents: number;
  description: string | null;
  file: File | null;
};

// src/lib/storage.ts reports machine-readable error codes; the caller owns
// the localized wording.
function receiptErrorToMessage(
  error: ReceiptError,
  expenses: ExpenseMessages,
): string {
  switch (error) {
    case "EMPTY":
      return expenses.receiptErrors.empty;
    case "TOO_LARGE":
      return expenses.receiptErrors.tooLarge;
    case "UNSUPPORTED_TYPE":
      return expenses.receiptErrors.unsupportedType;
  }
}

function parseItemRows(
  formData: FormData,
  expenses: ExpenseMessages,
): ItemInput[] | string {
  const dates = formData.getAll("item_date") as string[];
  const amounts = formData.getAll("item_amount") as string[];
  const descriptions = formData.getAll("item_description") as string[];
  const files = formData.getAll("item_file") as unknown as File[];

  const count = dates.length;
  if (count === 0) return expenses.messages.noItems;
  if (count > MAX_EXPENSE_ITEMS) {
    return interpolate(expenses.messages.maxItems, { max: MAX_EXPENSE_ITEMS });
  }

  const items: ItemInput[] = [];
  for (let i = 0; i < count; i++) {
    const parsed = expenseItemFormSchema(expenses).safeParse({
      date: dates[i],
      amountLabel: amounts[i],
      description: descriptions[i] || undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return interpolate(expenses.messages.itemError, {
        n: i + 1,
        error: issue?.message ?? expenses.messages.checkValue,
      });
    }
    const amountCents = parseAmountToCents(parsed.data.amountLabel);
    if (amountCents <= 0) {
      return interpolate(expenses.messages.itemAmountPositive, { n: i + 1 });
    }
    items.push({
      date: parseIsoDate(parsed.data.date),
      amountCents,
      description: parsed.data.description || null,
      file: files[i]?.size > 0 ? files[i] : null,
    });
  }
  return items;
}

// ============ 경비 신청서 작성 (EMPLOYEE, DRAFT) ============

export async function createExpenseReport(
  _state: ExpenseCreateState,
  formData: FormData,
): Promise<ExpenseCreateState> {
  const user = await requireUser();
  const { common, expenses } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }

  const meta = expenseReportCreateSchema(expenses).safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!meta.success) {
    return { fieldErrors: fieldErrors(meta.error.issues) };
  }

  const start = parseIsoDate(meta.data.periodStart);
  const end = parseIsoDate(meta.data.periodEnd);
  if (start.getTime() > end.getTime()) {
    return { message: expenses.messages.periodInvalid };
  }

  const parsedItems = parseItemRows(formData, expenses);
  if (typeof parsedItems === "string") {
    return { message: parsedItems };
  }

  // Categories are gone from the UI. Items still carry a categoryId column,
  // so every item lands in the company's default bucket (first active one,
  // created on demand for companies that have none).
  const totalCents = parsedItems.reduce((sum, it) => sum + it.amountCents, 0);

  const savedFiles: string[] = [];
  try {
    let defaultCategory = await prisma.expenseCategory.findFirst({
      where: { companyId: user.companyId, active: true },
      orderBy: { name: "asc" },
    });
    if (!defaultCategory) {
      const locale = await getLocale();
      defaultCategory = await prisma.expenseCategory.create({
        data: {
          companyId: user.companyId,
          name: locale === "ko" ? "일반" : "General",
          active: true,
        },
      });
    }

    const itemData = [];
    for (const it of parsedItems) {
      const receipts = [];
      if (it.file) {
        const saved = await saveReceipt(it.file);
        if (!saved.ok) return { message: receiptErrorToMessage(saved.error, expenses) };
        savedFiles.push(saved.stored.storedName);
        receipts.push({
          filename: saved.stored.filename,
          storedPath: saved.stored.storedName,
          mimeType: saved.stored.mimeType,
          size: saved.stored.size,
        });
      }
      itemData.push({
        date: it.date,
        categoryId: defaultCategory.id,
        amountCents: it.amountCents,
        description: it.description,
        receipts: { create: receipts },
      });
    }

    await prisma.expenseReport.create({
        data: {
          companyId: user.companyId,
          employeeId: user.employeeId,
          title: meta.data.title,
          periodStart: start,
          periodEnd: end,
          totalAmountCents: totalCents,
          // Pin the company currency instead of inheriting the column default,
          // which would label a KRW report as USD.
          currency: await getCompanyCurrency(user.companyId),
          items: { create: itemData },
        },
      });
  } catch {
    for (const name of savedFiles) await removeReceipt(name);
    return { message: expenses.messages.saveError };
  }

  revalidatePath("/hoohr/expenses");
  return { message: expenses.messages.reportCreated, ok: true };
}

// ============ 제출 (EMPLOYEE, DRAFT → SUBMITTED) ============

export async function submitExpenseReport(
  _state: ExpenseSubmitState,
  formData: FormData,
): Promise<ExpenseSubmitState> {
  const user = await requireUser();
  const { common, expenses } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: expenses.messages.reportInvalid };

  const report = await prisma.expenseReport.findFirst({
    where: { id, employeeId: user.employeeId, status: "DRAFT" },
  });
  if (!report) return { message: expenses.messages.cannotSubmit };

  const itemCount = await prisma.expenseItem.count({ where: { reportId: id } });
  if (itemCount === 0) {
    return { message: expenses.messages.noItemsToSubmit };
  }

  // A DB failure here must surface as a plain message, never an exception
  // banner: the report was already validated, so anything left is infra.
  try {
    await prisma.expenseReport.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  } catch {
    return { message: expenses.messages.saveError };
  }

  // NOT-1 (submission): tell every active admin. Best effort — the report is
  // already submitted, so a mail outage must not turn this into an error.
  const admins = await adminRecipients(user.companyId);
  if (admins.length > 0) {
    await notifyExpenseSubmitted({
      to: admins.map((a) => a.email),
      companyId: user.companyId,
      adminName: admins[0].name,
      requesterName: user.name,
      title: report.title,
      totalAmountCents: report.totalAmountCents,
      currency: report.currency,
    });
  }

  revalidatePath("/hoohr/expenses");
  return { message: expenses.messages.requestSubmitted, ok: true };
}

// ============ 삭제 (EMPLOYEE, DRAFT만) ============

export async function deleteExpenseReport(
  _state: ExpenseDeleteState,
  formData: FormData,
): Promise<ExpenseDeleteState> {
  const user = await requireUser();
  const { common, expenses } = await getDict();
  if (!user.employeeId) {
    return { message: common.decide.noEmployee };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: expenses.messages.reportInvalid };

  const report = await prisma.expenseReport.findFirst({
    where: { id, employeeId: user.employeeId, status: "DRAFT" },
  });
  if (!report) return { message: expenses.messages.cannotDelete };

  const receipts = await prisma.receiptFile.findMany({
    where: { item: { reportId: id } },
    select: { storedPath: true },
  });
  await prisma.expenseReport.delete({ where: { id } });
  for (const r of receipts) await removeReceipt(r.storedPath);

  revalidatePath("/hoohr/expenses");
  return { message: expenses.messages.reportDeleted, ok: true };
}

// ============ 승인/반려/결제 확정 (MANAGER / ADMIN) ============

export async function decideExpense(
  _state: ExpenseDecideState,
  formData: FormData,
): Promise<ExpenseDecideState> {
  const user = await requireUser();
  const { common, expenses } = await getDict();
  if (user.role !== "ADMIN") {
    return { message: common.decide.noPermission };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const unavailableMessage = common.decide.unavailable;

  if (!id) return { message: expenses.messages.reportInvalid };
  if (!["APPROVE", "REJECT", "PAY"].includes(decision)) {
    return { message: expenses.messages.invalidDecision };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: common.decide.rejectReasonRequired };
  }

  const expected = decision === "PAY" ? "APPROVED" : "SUBMITTED";
  const report = await prisma.expenseReport.findFirst({
    where: { id, companyId: user.companyId, status: expected },
    include: { employee: { select: { id: true, companyId: true, name: true, email: true } } },
  });
  if (
    !report ||
    report.employee.companyId !== user.companyId ||
    report.employeeId === user.employeeId
  ) {
    return { message: unavailableMessage };
  }

  const status =
    decision === "APPROVE" ? "APPROVED" : decision === "PAY" ? "PAID" : "REJECTED";
  // Captured in-transaction from the row that was actually updated, so the
  // notice cannot describe a different report than the one decided.
  let decided: ExpenseDecisionMail | null = null;

  try {
    decided = await prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findFirst({
        where: { id: user.id, companyId: user.companyId, isActive: true },
        select: { id: true },
      });
      if (!reviewer) return null;

      const fresh = await tx.expenseReport.findFirst({
        where: { id, companyId: user.companyId, status: expected },
        include: { employee: { select: { id: true, companyId: true, name: true, email: true } } },
      });
      if (
        !fresh ||
        fresh.employee.companyId !== user.companyId ||
        fresh.employeeId === user.employeeId
      ) {
        return null;
      }

      const result = await tx.expenseReport.updateMany({
        where: {
          id,
          companyId: user.companyId,
          status: expected,
          employee: { companyId: user.companyId },
        },
        data: {
          status,
          decidedById: reviewer.id,
          decidedAt: new Date(),
          comment: comment || null,
        },
      });
      if (result.count !== 1) return null;

      return {
        to: fresh.employee.email,
        requesterName: fresh.employee.name,
        title: fresh.title,
        totalAmountCents: fresh.totalAmountCents,
        currency: fresh.currency,
      };
    });
  } catch {
    return { message: unavailableMessage };
  }

  if (!decided) return { message: unavailableMessage };

  // NOT-1. Awaited for the same reason as in decideLeave, and equally safe:
  // the status change is already committed and the sender cannot throw.
  await notifyExpenseDecision({
    ...decided,
    companyId: user.companyId,
    reviewerName: user.name,
    decision: status as ExpenseDecisionOutcome,
    comment,
  });

  revalidatePath("/hoohr/expenses");
  const label =
    decision === "APPROVE"
      ? common.decide.approveDone
      : decision === "PAY"
        ? expenses.messages.payConfirmed
        : common.decide.rejectDone;
  return { message: label, ok: true };
}