// 근무일 계산에 필요한 주말 유틸 — 순수 함수 (DB 접근 없음).

import { parseWeekendDays, type IsoWeekday } from "@/lib/company-defaults";

/** 주휴일. 미지정 시 토·일. */
export type WeekendSet = ReadonlySet<IsoWeekday>;

const DEFAULT_WEEKEND: WeekendSet = new Set<IsoWeekday>([0, 6]);

/** Date → "YYYY-MM-DD" (UTC). */
export function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 저장 문자열("0,6") → WeekendSet. 파싱 실패/빈 값이면 토·일로 폴백한다.
 * 설정이 깨져도 근무일 계산이 멈추는 것보다 이전 동작을 유지하는 편이 낫다.
 */
export function toWeekendSet(raw: string | null | undefined): WeekendSet {
  return parseWeekendDays(raw) ?? DEFAULT_WEEKEND;
}

/** 해당 날짜가 근무일인가 (주휴일 제외). */
export function isWorkday(
  date: Date,
  weekend: WeekendSet = DEFAULT_WEEKEND,
): boolean {
  return !weekend.has(date.getUTCDay() as IsoWeekday);
}
