import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { getDict } from "@/i18n/server";
import { exportBackup, importBackup } from "@/lib/transfer";

/** 256MB cap: the whole backup buffers in memory on both ends. */
const MAX_BACKUP_BYTES = 256 * 1024 * 1024;

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Download everything (data + uploaded files) as one JSON document. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const doc = await exportBackup();
  const body = JSON.stringify(doc);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`hoohr-backup-${stamp(new Date())}.json`)}`,
    },
  });
}

/** Replace everything from an uploaded backup. Gated behind confirm=yes. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { settings } = await getDict();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: settings.messages.transferFailed }, { status: 400 });
  }
  const file = form.get("backup");
  const confirm = form.get("confirm");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: settings.messages.transferFileRequired }, { status: 400 });
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json({ ok: false, message: settings.messages.transferTooLarge }, { status: 400 });
  }

  let doc: unknown;
  try {
    doc = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ ok: false, message: settings.messages.transferBadFile }, { status: 400 });
  }

  const result = await importBackup(doc, typeof confirm === "string" ? confirm : null);
  if (!result.ok) {
    const message =
      result.error === "version"
        ? settings.messages.transferVersionMismatch
        : result.error === "confirm"
          ? settings.messages.transferConfirmRequired
          : settings.messages.transferFailed;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: settings.messages.transferRestored });
}
