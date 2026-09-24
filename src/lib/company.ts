import "server-only";
import { prisma } from "@/lib/prisma";

/** 회사 설정 timezone 조회 (기본 UTC). */
export async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone ?? "UTC";
}