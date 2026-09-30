// 회사의 주말·통화 기준. 순수 데이터/함수 모듈 (DB 접근 없음).
//
// 주말은 휴가 일수 계산의 정확성과 직결된다 — 5일 PTO 요청이 토·일을 걸치면
// 5일이어야지 7일이 아니다. 그래서 여기서 "주말"과 "공휴일"을 분리한다:
// 공휴일(Holiday)은 회사가 직접 등록하는 별개 데이터고, 이 모듈은 그게 아니라
// "어느 요일이 근무일인가"만 다룬다. 요일을 통째로 휴무로 만들면 모든 휴가
// 신청이 "근무일 없음"으로 실패하므로 검증에서 막는다.

/** 0=일요일 … 6=토요일 (Date#getUTCDay 와 동일). */
export type IsoWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** "0,6" 형태의 저장 문자열 → Set. 파싱 불가하면 null (호출부가 fallback). */
export function parseWeekendDays(raw: string | null | undefined): Set<IsoWeekday> | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const out = new Set<IsoWeekday>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    out.add(n as IsoWeekday);
  }
  return out.size > 0 ? out : null;
}

/** Set → "0,6". 저장 직렬화용. 항상 정렬되어 결정적. */
export function formatWeekendDays(days: ReadonlySet<number>): string {
  return [...days].sort((a, b) => a - b).join(",");
}

/**
 * 통화 코드 검증.
 *
 * Intl 은 *구조*만 검사한다 — "ZZZ" 는 3글자라 예외를 던지지 않고 그대로
 * "ZZZ 12.50" 로 표기된다. 그 값이 회계용 CSV export 까지 흘러가므로, 실제
 * ISO 4217 목록에 있는 코드만 통과시킨다.
 */
export function isValidCurrency(currency: string): boolean {
  if (!/^[A-Za-z]{3}$/.test(currency)) return false;
  if (!SUPPORTED_CURRENCIES.has(currency.toUpperCase())) return false;
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency });
    return true;
  } catch {
    return false;
  }
}

/** ISO 4217 목록. 엔진이 못 내면 형식 검사만으로 폴백한다. */
const SUPPORTED_CURRENCIES: ReadonlySet<string> = (() => {
  try {
    const list = Intl.supportedValuesOf("currency");
    if (Array.isArray(list) && list.length > 0) return new Set(list);
  } catch {
    // 구형 런타임에서는 지원되지 않는다.
  }
  return new Set(["USD", "KRW", "EUR", "JPY", "GBP", "CNY"]);
})();

/** 검증된 통화 목록 (통화 셀렉트용). 실제 통화만, 코드순으로. */
export function currencyOptions(): { value: string; label: string }[] {
  return [...SUPPORTED_CURRENCIES]
    .sort()
    .map((code) => ({
      value: code,
      label: `${code} — ${currencyName(code)}`,
    }));
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}
