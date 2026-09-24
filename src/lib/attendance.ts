// 근태 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).
// 시간은 항상 UTC로 저장하고, 표시는 회사 timezone 기준.

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

export type AttendanceEventLike = { kind: string; at: Date | string };

/** 출근/퇴근 이벤트들을 순차 짝지어 총 근무 시간(ms)을 계산한다. 마지막 출근(미퇴근)은 제외. */
export function workedMs(events: AttendanceEventLike[]): number {
  let total = 0;
  let openIn: number | null = null;
  for (const ev of events) {
    const t = new Date(ev.at).getTime();
    if (ev.kind === "CHECK_IN") {
      openIn = t;
    } else if (ev.kind === "CHECK_OUT" && openIn !== null) {
      total += t - openIn;
      openIn = null;
    }
  }
  return total;
}

/** 마지막 이벤트가 출근(미퇴근) 상태인지 — 즉 현재 '근무 중'인지 여부 */
export function isOpenSegment(events: AttendanceEventLike[]): boolean {
  if (events.length === 0) return false;
  return events[events.length - 1].kind === "CHECK_IN";
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "-";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** tz 기준 시각 표시 (HH:MM) */
export function formatTime(d: Date | null | undefined, tz: string): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

/** 날짜형(@db.Date = UTC 자정) 값을 달력 날짜로 표시 */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatDayWithWeekday(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(d: Date | null | undefined, tz: string): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

/** YYYY-MM-DD 문자열(회사 tz '오늘') 주어졌을 때 날짜 유형 변경 없이 그대로 표시 */
export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}