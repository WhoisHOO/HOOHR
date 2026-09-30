// 날짜/월 계산 순수 유틸 — 휴가와 경비가 공유한다 (DB 접근 없음).
// 시간은 항상 UTC로 저장하고, "오늘"의 기준은 회사 timezone 이다.
//
// 이 파일은 근태 화면에서 쓰이던 유틸집합이었다. 근태가 삭제되면서 근무시간
// 계산과 표시 함수만 사라지고, 아래 날짜 헬퍼들은 휴가·경비 화면에서 계속 쓰이므로
// 이름에서 근태를 뺀다. (이전 경로: src/lib/attendance.ts)

/** tz 기준으로 주어진 시각의 "달력 날짜" 문자열(YYYY-MM-DD)을 반환한다. */
export function zonedDateString(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(d);
}

/** tz 기준 "오늘"을 UTC 자정 DateTime(날짜형 @db.Date 값)으로 반환한다. */
export function zonedToday(tz: string): Date {
  return new Date(`${zonedDateString(new Date(), tz)}T00:00:00.000Z`);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** 주어진 날짜(UTC 자정 기준)의 해당 월 [시작, 끝) 범위를 반환한다. */
export function monthBounds(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)),
    end: new Date(Date.UTC(y, m + 1, 1)),
  };
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

/** YYYY-MM-DD 문자열(회사 tz '오늘') 주어졌을 때 날짜 유형 변경 없이 그대로 표시 */
export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
