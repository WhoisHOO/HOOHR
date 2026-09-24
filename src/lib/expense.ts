// 경비 도메인의 순수 유틸 — 표시/계산 전용 (DB 접근 없음).

/** cents → 통화 표시 (기본 USD). */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
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