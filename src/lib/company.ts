import "server-only";
import { prisma } from "@/lib/prisma";
import { toWeekendSet, type WeekendSet } from "@/lib/holidays";

/** 회사 설정 timezone 조회 (기본 UTC). */
export async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone ?? "UTC";
}

/**
 * 통화 코드 조회. formatMoney 는 존재하지 않는 통화 코드에 RangeError 를 던져
 * 화면을 500 으로 만들기 때문에, 여기서 항상 유효한 값만 돌려준다.
 */
export async function getCompanyCurrency(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  return company?.currency || "USD";
}

/** 주휴일 원본 문자열 ("0,6"). 클라이언트에 넘겨 서버/UI 계산을 맞출 때 사용. */
export async function getCompanyWeekendRaw(
  companyId: string,
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { weekendDays: true },
  });
  return company?.weekendDays ?? "0,6";
}

/** 주휴일 조회. 저장값이 손상돼도 토·일로 폴백한다 (toWeekendSet). */
export async function getCompanyWeekend(companyId: string): Promise<WeekendSet> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { weekendDays: true },
  });
  return toWeekendSet(company?.weekendDays);
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