import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { uploadDir } from "@/lib/storage";

const LOGO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Company logo for the sidebar header. Any member of the company may view it. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { logoPath: true, logoMime: true },
  });
  if (!company?.logoPath) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Stored names are `logo-<uuid>.<ext>` minted server-side; basename anyway.
  const storedName = path.basename(company.logoPath);
  if (!storedName.startsWith("logo-")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const buf = await readFile(
      path.join(/*turbopackIgnore: true*/ uploadDir(), storedName),
    );
    const mime =
      company.logoMime || LOGO_MIME[path.extname(storedName)] || "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
