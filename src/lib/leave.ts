// 휴가 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).

import { isWorkday, type WeekendSet } from "@/lib/weekend";
import { DEFAULT_INTL_LOCALE, type InltLocale } from "@/i18n/config";

/** [start, end] 구간의 근무일 수 (주휴일 제외, UTC 날짜 기준). */
export function countWorkdays(
  start: Date,
  end: Date,
  weekend?: WeekendSet,
): number {
  let count = 0;
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    if (isWorkday(cur, weekend)) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** 요청 일수: 반차면 0.5, 아니면 근무일 수. */
export function computeLeaveDays(
  start: Date,
  end: Date,
  isHalfDay: boolean,
  weekend?: WeekendSet,
): number {
  return isHalfDay ? 0.5 : countWorkdays(start, end, weekend);
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
