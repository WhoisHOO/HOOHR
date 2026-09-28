import "server-only";
import { prisma } from "@/lib/prisma";
import { isoDateKey, toHolidaySet, type HolidaySet } from "@/lib/holidays";

/** 회사 공휴일 전체를 "YYYY-MM-DD" 집합으로 (계산용). */
export async function getCompanyHolidays(companyId: string): Promise<HolidaySet> {
  const rows = await prisma.holiday.findMany({
    where: { companyId },
    select: { date: true },
  });
  return toHolidaySet(rows);
}

/** 회사 공휴일 "YYYY-MM-DD" → 이름 맵 (표시용). */
export async function getCompanyHolidayNames(
  companyId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.holiday.findMany({
    where: { companyId },
    select: { date: true, name: true },
  });
  return new Map(rows.map((row) => [isoDateKey(row.date), row.name]));
}

/** 특정 날짜의 공휴일명 (없으면 null). */
export async function getCompanyHolidayName(
  companyId: string,
  date: Date,
): Promise<string | null> {
  const row = await prisma.holiday.findFirst({
    where: { companyId, date },
    select: { name: true },
  });
  return row?.name ?? null;
}
