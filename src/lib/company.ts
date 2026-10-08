import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COUNTRY, countryDefaults } from "@/lib/country";
import type { Locale } from "@/i18n/config";
import { toWeekendSet, type WeekendSet } from "@/lib/weekend";

/**
 * 설치할 때 고른 국가 (단일 회사 기준). 통화·시간대·화면 언어가 모두 여기서
 * 파생되므로, 요청마다 쿠키를 고르는 대신 회사 행 하나를 진실의 원천으로 쓴다.
 * 요청 단위로 메모이즈된다.
 *
 * DB가 아직 준비되지 않은 첫 실행에서도 로그인 화면은 떠야 하므로 조회 실패는
 * 기본 국가로 삼킨다 (첫 화면이 500이 되는 것보다 낫다).
 */
export const getPrimaryCompanyCountry = cache(async (): Promise<string> => {
  try {
    const company = await prisma.company.findFirst({
      select: { country: true },
      orderBy: { createdAt: "asc" },
    });
    return company?.country ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
});

/**
 * 회사의 국가가 정하는 화면 언어. id 를 주면 그 회사, 안 주면 최초 회사(단일
 * 테넌트 설치)의 언어를 돌려준다 - 언어 설정 자체가 없으므로 항상 이것으로
 * 결정된다.
 */
export async function getCompanyLocale(companyId?: string): Promise<Locale> {
  if (!companyId) return countryDefaults(await getPrimaryCompanyCountry()).locale;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { country: true },
  });
  return countryDefaults(company?.country).locale;
}

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