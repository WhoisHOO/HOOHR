// 휴가 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).

/** [start, end] 구간의 근무일 수 (주말 Sat/Sun 제외, UTC 날짜 기준). */
export function countWorkdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** 요청 일수: 반차면 0.5, 아니면 근무일 수. */
export function computeLeaveDays(start: Date, end: Date, isHalfDay: boolean): number {
  return isHalfDay ? 0.5 : countWorkdays(start, end);
}

/** 잔여 연차 = 부여 - 사용 + 조정. */
export function remainingDays(bal: {
  grantedDays: number;
  usedDays: number;
  adjustDays: number;
}): number {
  return bal.grantedDays - bal.usedDays + bal.adjustDays;
}

// 날짜형(@db.Date = UTC 자정) 값들을 "M월 D일" 표기로.
export function formatLeaveDay(d: Date): string {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${m}월 ${day}일`;
}

/** 날짜 범위를 "M월 D일 ~ M월 D일"로 표기. 같은 달이면 "M월 D일~E일". */
export function formatLeaveRange(start: Date, end: Date): string {
  if (start.getTime() === end.getTime()) return formatLeaveDay(start);
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${formatLeaveDay(start)}~${end.getUTCDate()}일`;
  }
  return `${formatLeaveDay(start)} ~ ${formatLeaveDay(end)}`;
}

export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
