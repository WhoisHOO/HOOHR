// 경비 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).

import { DEFAULT_INTL_LOCALE, type InltLocale } from "@/i18n/config";

/** cents → 숫자 표시 (통화 기호·코드 없음, 소수 둘째 자리). */
export function formatMoney(
  cents: number,
  _currency = "USD",
  intl: InltLocale = DEFAULT_INTL_LOCALE,
): string {
  return new Intl.NumberFormat(intl, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** 금액 입력 문자열("12.50") → cents. */
export function parseAmountToCents(label: string): number {
  const value = parseFloat(label);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

export function formatDateInput(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}