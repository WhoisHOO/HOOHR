// 휴가/근무일 계산에 필요한 공휴일 유틸 — 순수 함수 (DB 접근 없음).

/** "YYYY-MM-DD" (UTC 자정 기준) 키 집합. */
export type HolidaySet = ReadonlySet<string>;

export type HolidayRow = { date: Date };

/** DB rows(@db.Date) → "YYYY-MM-DD" 집합. */
export function toHolidaySet(rows: readonly HolidayRow[]): HolidaySet {
  return new Set(rows.map((row) => isoDateKey(row.date)));
}

/** Date → "YYYY-MM-DD" (UTC). */
export function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 해당 날짜가 근무일인가 (주말 + 공휴일 제외). */
export function isWorkday(date: Date, holidays?: HolidaySet): boolean {
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays?.has(isoDateKey(date));
}
