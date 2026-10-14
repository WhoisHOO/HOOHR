// 국가 = 회사의 기준.
//
// 사용자가 설치할 때 "어느 국가로 사용할건가"를 한 번 고르면 통화·시간대·기본
// 언어가 전부 따라온다. 사이드바의 한국어/English 전환이 있으면 쿠키가 우선한다.
// 이 모듈은 순수 데이터/함수만 담는다 (DB 접근 없음) 그래야 클라이언트에서도
// import 할 수 있다.

import type { Locale } from "../i18n/config";

export const COUNTRIES = ["KR", "US"] as const;

export type CountryCode = (typeof COUNTRIES)[number];

export const DEFAULT_COUNTRY: CountryCode = "KR";

/** 국가 이름은 그 나라 말로 (endonym) - 고르는 사람이 자기 것을 알아본다. */
export const COUNTRY_LABELS: Record<CountryCode, string> = {
  KR: "대한민국",
  US: "미국",
};

export function isCountry(value: unknown): value is CountryCode {
  return (
    typeof value === "string" && (COUNTRIES as readonly string[]).includes(value)
  );
}

/** 국가에 따라 자동으로 정해지는 회사 설정. */
export type CountryDefaults = {
  currency: string;
  timezone: string;
  locale: Locale;
};

export const COUNTRY_DEFAULTS: Record<CountryCode, CountryDefaults> = {
  KR: { currency: "KRW", timezone: "Asia/Seoul", locale: "ko" },
  US: { currency: "USD", timezone: "America/New_York", locale: "en" },
};

/** 손상된 값이 들어와도 기본 국가로 폴백한다. */
export function countryDefaults(value: unknown): CountryDefaults {
  return COUNTRY_DEFAULTS[isCountry(value) ? value : DEFAULT_COUNTRY];
}
