"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import { parseIsoDate } from "@/lib/attendance";
import { parseAmountToCents } from "@/lib/expense";
import { removeReceipt, saveReceipt } from "@/lib/storage";
import {
  approvalReviewerFromUser,
  approvalReviewerSelect,
  approvalTargetInclude,
  canActAsAdmin,
  canReviewEmployee,
} from "@/lib/team";
import {
  ExpenseItemFormSchema,
  ExpenseReportCreateSchema,
  MAX_EXPENSE_ITEMS,
  type ExpenseCreateState,
  type ExpenseDecideState,
  type ExpenseDeleteState,
  type ExpenseSubmitState,
} from "@/lib/expense-validation";

type ItemInput = {
  date: Date;
  categoryId: string;
  amountCents: number;
  description: string | null;
  file: File | null;
};

function parseItemRows(formData: FormData): ItemInput[] | string {
  const dates = formData.getAll("item_date") as string[];
  const categoryIds = formData.getAll("item_categoryId") as string[];
  const amounts = formData.getAll("item_amount") as string[];
  const descriptions = formData.getAll("item_description") as string[];
  const files = formData.getAll("item_file") as unknown as File[];

  const count = dates.length;
  if (count === 0) return "항목을 하나 이상 추가하세요.";
  if (count > MAX_EXPENSE_ITEMS) {
    return `항목은 최대 ${MAX_EXPENSE_ITEMS}개까지 입력할 수 있습니다.`;
  }

  const items: ItemInput[] = [];
  for (let i = 0; i < count; i++) {
    const parsed = ExpenseItemFormSchema.safeParse({
      date: dates[i],
      categoryId: categoryIds[i],
      amountLabel: amounts[i],
      description: descriptions[i] || undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return `항목 ${i + 1} 오류: ${issue?.message ?? "값을 확인하세요"}`;
    }
    const amountCents = parseAmountToCents(parsed.data.amountLabel);
    if (amountCents <= 0) {
      return `항목 ${i + 1} 오류: 금액은 0보다 커야 합니다`;
    }
    items.push({
      date: parseIsoDate(parsed.data.date),
      categoryId: parsed.data.categoryId,
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
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }

  const meta = ExpenseReportCreateSchema.safeParse({
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
    return { message: "기간이 올바르지 않습니다." };
  }

  const parsedItems = parseItemRows(formData);
  if (typeof parsedItems === "string") {
    return { message: parsedItems };
  }

  const categoryIds = [...new Set(parsedItems.map((i) => i.categoryId))];
  const categories = await prisma.expenseCategory.findMany({
    where: {
      companyId: user.companyId,
      id: { in: categoryIds },
      active: true,
    },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) {
    return { message: "유효하지 않은 카테고리가 포함되어 있습니다." };
  }

  const totalCents = parsedItems.reduce((sum, it) => sum + it.amountCents, 0);

  const savedFiles: string[] = [];
  try {
    const itemData = [];
    for (const it of parsedItems) {
      const receipts = [];
      if (it.file) {
        const saved = await saveReceipt(it.file);
        if (!saved.ok) return { message: saved.error };
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
        categoryId: it.categoryId,
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
        items: { create: itemData },
      },
    });
  } catch {
    for (const name of savedFiles) await removeReceipt(name);
    return { message: "저장 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  revalidatePath("/app/expenses");
  return { message: "경비 신청서가 작성되었습니다.", ok: true };
}

// ============ 제출 (EMPLOYEE, DRAFT → SUBMITTED) ============

export async function submitExpenseReport(
  _state: ExpenseSubmitState,
  formData: FormData,
): Promise<ExpenseSubmitState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "보고서 정보가 올바르지 않습니다." };

  const report = await prisma.expenseReport.findFirst({
    where: { id, employeeId: user.employeeId, status: "DRAFT" },
  });
  if (!report) return { message: "제출할 수 없는 보고서입니다." };

  const itemCount = await prisma.expenseItem.count({ where: { reportId: id } });
  if (itemCount === 0) {
    return { message: "항목이 없는 보고서는 제출할 수 없습니다." };
  }

  await prisma.expenseReport.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  revalidatePath("/app/expenses");
  return { message: "승인 요청이 제출되었습니다.", ok: true };
}

// ============ 삭제 (EMPLOYEE, DRAFT만) ============

export async function deleteExpenseReport(
  _state: ExpenseDeleteState,
  formData: FormData,
): Promise<ExpenseDeleteState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { message: "직원 정보가 없습니다. 관리자에게 문의하세요." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "보고서 정보가 올바르지 않습니다." };

  const report = await prisma.expenseReport.findFirst({
    where: { id, employeeId: user.employeeId, status: "DRAFT" },
  });
  if (!report) return { message: "삭제할 수 없는 보고서입니다." };

  const receipts = await prisma.receiptFile.findMany({
    where: { item: { reportId: id } },
    select: { storedPath: true },
  });
  await prisma.expenseReport.delete({ where: { id } });
  for (const r of receipts) await removeReceipt(r.storedPath);

  revalidatePath("/app/expenses");
  return { message: "보고서가 삭제되었습니다.", ok: true };
}

// ============ 승인/반려/결제 확정 (MANAGER / ADMIN) ============

export async function decideExpense(
  _state: ExpenseDecideState,
  formData: FormData,
): Promise<ExpenseDecideState> {
  const user = await requireUser();
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return { message: "승인 권한이 없습니다." };
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const unavailableMessage = "요청을 처리할 수 없습니다. 최신 목록을 확인해주세요.";

  if (!id) return { message: "보고서 정보가 올바르지 않습니다." };
  if (!["APPROVE", "REJECT", "PAY"].includes(decision)) {
    return { message: "결정 값이 올바르지 않습니다." };
  }
  if (decision === "REJECT" && comment.length < 2) {
    return { message: "반려 시 사유를 입력해주세요." };
  }
  if (decision === "PAY" && user.role !== "ADMIN") {
    return { message: "결제 확정은 관리자만 할 수 있습니다." };
  }

  const expected = decision === "PAY" ? "APPROVED" : "SUBMITTED";
  const report = await prisma.expenseReport.findFirst({
    where: { id, companyId: user.companyId, status: expected },
    include: approvalTargetInclude,
  });
  if (
    !report ||
    report.employee.companyId !== user.companyId ||
    (decision === "PAY"
      ? !canActAsAdmin(user)
      : !canReviewEmployee(user, report))
  ) {
    return { message: unavailableMessage };
  }

  const status =
    decision === "APPROVE" ? "APPROVED" : decision === "PAY" ? "PAID" : "REJECTED";
  const updated = await prisma.$transaction(async (tx) => {
    const reviewer = await tx.user.findFirst({
      where: { id: user.id, companyId: user.companyId, isActive: true },
      select: approvalReviewerSelect,
    });
    if (!reviewer) return false;

    const fresh = await tx.expenseReport.findFirst({
      where: { id, companyId: user.companyId, status: expected },
      include: approvalTargetInclude,
    });
    if (
      !fresh ||
      fresh.employee.companyId !== user.companyId ||
      (decision === "PAY"
        ? !canActAsAdmin(approvalReviewerFromUser(reviewer))
        : !canReviewEmployee(approvalReviewerFromUser(reviewer), fresh))
    ) {
      return false;
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
    return result.count === 1;
  });

  if (!updated) return { message: unavailableMessage };

  revalidatePath("/app/expenses");
  const label =
    decision === "APPROVE"
      ? "승인 처리되었습니다."
      : decision === "PAY"
        ? "결제가 확정되었습니다."
        : "반려 처리되었습니다.";
  return { message: label, ok: true };
}