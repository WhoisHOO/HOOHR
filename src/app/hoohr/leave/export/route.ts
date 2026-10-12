import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getDict } from "@/i18n/server";

function formatDateNoPad(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseDay(value: string | null): Date | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return null;
  }
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return d;
}

/**
 * Leave CSV over a date range (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, defaults to
 * the current month). Admin only — same rule as the expense export: staff
 * have no export function.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { common, leave } = await getDict();

  const url = new URL(request.url);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  if (
    (fromRaw !== null && !parseDay(fromRaw)) ||
    (toRaw !== null && !parseDay(toRaw))
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }
  const from = (fromRaw && parseDay(fromRaw)) || monthStart;
  const to = (toRaw && parseDay(toRaw)) || monthEnd;
  if (from.getTime() > to.getTime()) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      companyId: user.companyId,
      status: { not: "CANCELED" },
      startDate: { lte: to },
      endDate: { gte: from },
    },
    include: {
      policy: { select: { name: true, kind: true } },
      employee: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  const columns = leave.export.columns;
  const statusLabel = (s: string) =>
    common.leaveStatus[s as keyof typeof common.leaveStatus] ?? s;
  const rows: string[][] = [
    [columns.employee, columns.type, columns.start, columns.end, columns.status, columns.memo],
  ];
  for (const r of requests) {
    rows.push(
      [
        r.employee.name,
        common.leaveKind[r.policy.kind as keyof typeof common.leaveKind] ?? r.policy.name,
        formatDateNoPad(r.startDate),
        formatDateNoPad(r.endDate),
        statusLabel(r.status),
        r.reason ?? "",
      ].map(csvEscape),
    );
  }

  const csv = `\uFEFF${rows.map((r) => r.join(",")).join("\r\n")}\r\n`;
  const tag = `${formatDateNoPad(from).replaceAll("-", "")}-${formatDateNoPad(to).replaceAll("-", "")}`;

  return new NextResponse(new Uint8Array(Buffer.from(csv, "utf8")), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`leave-${tag}.csv`)}`,
    },
  });
}
