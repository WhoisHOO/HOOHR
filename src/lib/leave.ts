// 휴가 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).

import { isWorkday, type HolidaySet } from "@/lib/holidays";
import { DEFAULT_INTL_LOCALE, type InltLocale } from "@/i18n/config";

/** [start, end] 구간의 근무일 수 (주말 제외 + 등록된 공휴일 제외, UTC 날짜 기준). */
export function countWorkdays(
  start: Date,
  end: Date,
  holidays?: HolidaySet,
): number {
  let count = 0;
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    if (isWorkday(cur, holidays)) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** 요청 일수: 반차면 0.5, 아니면 근무일 수. */
export function computeLeaveDays(
  start: Date,
  end: Date,
  isHalfDay: boolean,
  holidays?: HolidaySet,
): number {
  return isHalfDay ? 0.5 : countWorkdays(start, end, holidays);
}

/** 잔여 연차 = 부여 - 사용 + 조정. */
export function remainingDays(bal: {
  grantedDays: number;
  usedDays: number;
  adjustDays: number;
}): number {
  return bal.grantedDays - bal.usedDays + bal.adjustDays;
}

// 날짜형(@db.Date = UTC 자정) 값들을 지역 표기로. ko-KR이면 "M월 D일",
// en-US이면 "M/D"가 된다.
export function formatLeaveDay(
  d: Date,
  intl: InltLocale = DEFAULT_INTL_LOCALE,
): string {
  return new Intl.DateTimeFormat(intl, {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** 날짜 범위 표기. 같은 날짜면 하루만, 그 외는 "~"로 연결. */
export function formatLeaveRange(
  start: Date,
  end: Date,
  intl: InltLocale = DEFAULT_INTL_LOCALE,
): string {
  if (start.getTime() === end.getTime()) return formatLeaveDay(start, intl);
  return `${formatLeaveDay(start, intl)}~${formatLeaveDay(end, intl)}`;
}

export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
