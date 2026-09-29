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

/**
 * 회사 이름 조회. The invite email names the company in its subject and body, so
 * a missing row degrades to a generic label rather than a blank or "null".
 */
export async function getCompanyName(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  return company?.name || "HOOHR";
}