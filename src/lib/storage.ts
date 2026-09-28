import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export type StoredFile = {
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
};

/**
 * Receipt storage is runtime data, not a build-time dependency.
 *
 * `uploads/` is created on demand by `mkdir` in `saveReceipt`, and the
 * Dockerfile pre-creates `/app/uploads` owned by the `node` user for the same
 * reason. The `UPLOAD_DIR` override can point anywhere, so the bundler's static
 * analyzer cannot scope the resulting path to a subfolder of `process.cwd()` and
 * falls back to conservatively tracing the entire project into the server
 * output - 158 stray files, including LOG.md, every `_test-*.ts` and the whole
 * `src/` tree. The `turbopackIgnore` comments below are the opt-out the analyzer
 * itself suggests for filesystem access that only ever happens at runtime.
 */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export type ReceiptError = "EMPTY" | "TOO_LARGE" | "UNSUPPORTED_TYPE";

export async function saveReceipt(
  file: File,
): Promise<
  | { ok: true; stored: StoredFile }
  | { ok: false; error: ReceiptError }
> {
  if (file.size === 0) return { ok: false, error: "EMPTY" };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "TOO_LARGE" };
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) return { ok: false, error: "UNSUPPORTED_TYPE" };

  const storedName = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, storedName), buf);

  return {
    ok: true,
    stored: {
      filename: file.name || storedName,
      storedName,
      mimeType: file.type,
      size: buf.length,
    },
  };
}

export async function removeReceipt(storedName: string): Promise<void> {
  try {
    await unlink(path.join(/*turbopackIgnore: true*/ uploadDir(), storedName));
  } catch {
    // 이미 없거나 경로 문제 — 무시
  }
}

export function receiptPath(storedName: string): string {
  return path.join(/*turbopackIgnore: true*/ uploadDir(), path.basename(storedName));
}
