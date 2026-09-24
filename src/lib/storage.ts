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

export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function saveReceipt(
  file: File,
): Promise<{ ok: true; stored: StoredFile } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "빈 파일입니다." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "파일은 5MB 이하만 올릴 수 있습니다." };
  }
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) return { ok: false, error: "지원 형식: JPEG, PNG, WEBP, PDF" };

  const storedName = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), buf);

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
    await unlink(path.join(uploadDir(), storedName));
  } catch {
    // 이미 없거나 경로 문제 — 무시
  }
}

export function receiptPath(storedName: string): string {
  return path.join(uploadDir(), path.basename(storedName));
}