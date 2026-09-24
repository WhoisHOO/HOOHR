import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { receiptPath } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const storedPath = (await params).file;
  const isReviewer = user.role === "MANAGER" || user.role === "ADMIN";

  const receipt = await prisma.receiptFile.findFirst({
    where: { storedPath },
    include: { item: { include: { report: { select: { employeeId: true } } } } },
  });
  if (
    !receipt ||
    (receipt.item.report.employeeId !== user.employeeId && !isReviewer)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buf = await readFile(receiptPath(receipt.storedPath));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(receipt.filename)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}