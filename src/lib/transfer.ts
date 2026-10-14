import "server-only";

import { readdir, readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { uploadDir } from "@/lib/storage";
import { version as appVersion } from "../../package.json";

/**
 * One-click move to another machine (e.g. an always-on Mac Mini).
 *
 * Export packs every table (IDs preserved) plus every uploaded file into one
 * JSON document; import wipes the target and loads it. No pg_dump binary, no
 * tar tool, no new dependency: file bytes ride as base64, which is dumb and
 * hard to get wrong at this scale.
 *
 * Safety properties (all load bearing):
 * - Secrets are NOT included: .env stays on each machine (fresh install mints
 *   its own AUTH_SECRET; everyone simply logs in again after a move).
 * - Import refuses a version mismatch, so a newer/older schema can never meet
 *   older/newer rows halfway.
 * - Import runs in one transaction: any failure rolls everything back, the
 *   target is never left half-loaded.
 * - The caller must pass confirm=yes (the UI gates it behind a checkbox).
 */

const TABLES = [
  "company",
  "user",
  "employee",
  "leavePolicy",
  "expenseCategory",
  "invitation",
  "leaveRequest",
  "expenseReport",
  "expenseItem",
  "receiptFile",
  "approval",
  "notification",
] as const;

type TableName = (typeof TABLES)[number];

const SQL_TABLES: Record<TableName, string> = {
  company: '"Company"',
  user: '"User"',
  employee: '"Employee"',
  leavePolicy: '"LeavePolicy"',
  expenseCategory: '"ExpenseCategory"',
  invitation: '"Invitation"',
  leaveRequest: '"LeaveRequest"',
  expenseReport: '"ExpenseReport"',
  expenseItem: '"ExpenseItem"',
  receiptFile: '"ReceiptFile"',
  approval: '"Approval"',
  notification: '"Notification"',
};

type TableDelegate = {
  findMany: () => Promise<Record<string, unknown>[]>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
};

function delegateOf(
  client: unknown,
  table: TableName,
): TableDelegate {
  return (client as Record<TableName, unknown>)[table] as TableDelegate;
}

export type BackupFile = { name: string; base64: string };

export type BackupDocument = {
  app: "hoohr";
  version: string;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
  files: BackupFile[];
};

function safeName(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.startsWith(".")) {
    return null;
  }
  return name;
}

export async function exportBackup(): Promise<BackupDocument> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) {
    // Full rows: IDs, timestamps and all. JSON.stringify turns Dates to ISO.
    tables[t] = await delegateOf(prisma, t).findMany();
  }

  const files: BackupFile[] = [];
  try {
    const names = await readdir(uploadDir());
    for (const name of names) {
      const safe = safeName(name);
      if (!safe) continue;
      const buf = await readFile(path.join(uploadDir(), safe));
      files.push({ name: safe, base64: buf.toString("base64") });
    }
  } catch {
    // No uploads yet — a data-only backup is still complete.
  }

  return {
    app: "hoohr",
    version: appVersion,
    exportedAt: new Date().toISOString(),
    tables,
    files,
  };
}

export type ImportResult = { ok: true } | { ok: false; error: string };

export async function importBackup(
  doc: unknown,
  confirm: string | null,
): Promise<ImportResult> {
  if (confirm !== "yes") return { ok: false, error: "confirm" };
  if (!doc || typeof doc !== "object") return { ok: false, error: "shape" };
  const backup = doc as Partial<BackupDocument>;
  if (backup.app !== "hoohr" || typeof backup.tables !== "object" || !backup.tables) {
    return { ok: false, error: "shape" };
  }
  if (backup.version !== appVersion) return { ok: false, error: "version" };
  for (const t of TABLES) {
    if (!Array.isArray(backup.tables[t])) return { ok: false, error: "shape" };
  }
  const files = Array.isArray(backup.files) ? backup.files : [];
  for (const f of files) {
    if (typeof f?.name !== "string" || typeof f?.base64 !== "string" || !safeName(f.name)) {
      return { ok: false, error: "shape" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // One TRUNCATE instead of twelve ordered deletes: CASCADE settles every
      // foreign key regardless of direction, so an unknown relation can never
      // strand the wipe halfway.
      const names = TABLES.map((t) => SQL_TABLES[t]).join(",");
      await tx.$executeRawUnsafe(`TRUNCATE ${names} CASCADE;`);
      for (const t of TABLES) {
        const rows = backup.tables?.[t] as Record<string, unknown>[];
        if (rows.length === 0) continue;
        await delegateOf(tx, t).createMany({ data: rows });
      }
    });
  } catch {
    return { ok: false, error: "load" };
  }

  // Files only after the data committed: a failed load must not orphan blobs.
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    const existing = await readdir(dir).catch(() => [] as string[]);
    for (const name of existing) {
      const safe = safeName(name);
      if (safe) await unlink(path.join(dir, safe)).catch(() => {});
    }
    for (const f of files) {
      const safe = safeName(f.name);
      if (!safe) continue;
      await writeFile(path.join(dir, safe), Buffer.from(f.base64, "base64"));
    }
  } catch {
    return { ok: false, error: "files" };
  }

  return { ok: true };
}
