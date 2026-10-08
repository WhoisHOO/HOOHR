import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { monthBounds } from "@/lib/date";
import { getDict } from "@/i18n/server";

function formatDateNoPad(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { common, expenses } = await getDict();

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  let monthDate = new Date();
  if (monthParam !== null) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (!match) {
      return new NextResponse("Bad request", { status: 400 });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      return new NextResponse("Bad request", { status: 400 });
    }
    monthDate = new Date(Date.UTC(year, month - 1, 1));
  }

  const { start, end } = monthBounds(monthDate);
  const yyyymm = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const isAdmin = user.role === "ADMIN";
  const employeeScope = isAdmin
    ? { companyId: user.companyId }
    : {
        companyId: user.companyId,
        ...(user.employeeId
          ? { id: user.employeeId }
          : { id: { in: [] } }),
      };

  const items = await prisma.expenseItem.findMany({
    where: {
      date: { gte: start, lt: end },
      report: {
        companyId: user.companyId,
        status: { not: "DRAFT" },
        employee: employeeScope,
      },
    },
    include: {
      category: { select: { name: true } },
      report: {
        select: {
          title: true,
          status: true,
          employee: { select: { name: true } },
          currency: true,
        },
      },
      receipts: { select: { filename: true } },
    },
    orderBy: [{ date: "asc" }, { report: { createdAt: "asc" } }],
  });

  const rows: string[][] = [];
  const columns = expenses.export.columns;
  const statusLabel = (s: string) =>
    common.expenseStatus[s as keyof typeof common.expenseStatus] ?? s;
  if (isAdmin) {
    rows.push([
      columns.date, columns.category, columns.employee, columns.title, columns.status, columns.amount, columns.currency, columns.description, columns.receipts,
    ]);
  } else {
    rows.push([columns.date, columns.category, columns.title, columns.status, columns.amount, columns.currency, columns.description, columns.receipts]);
  }
  for (const it of items) {
    const base = [
      formatDateNoPad(it.date),
      it.category.name,
      ...(isAdmin ? [it.report.employee.name] : []),
      it.report.title,
      statusLabel(it.report.status),
      (it.amountCents / 100).toFixed(2),
      it.report.currency,
      it.description ?? "",
      it.receipts.map((r) => r.filename).join(" | "),
    ];
    rows.push(base.map(csvEscape));
  }

  const csv = `\uFEFF${rows.map((r) => r.join(",")).join("\r\n")}\r\n`;

  return new NextResponse(new Uint8Array(Buffer.from(csv, "utf8")), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`expenses-${yyyymm}.csv`)}`,
    },
  });
}
