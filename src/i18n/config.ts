export const LOCALES = ["ko", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

export const LOCALE_COOKIE = "locale";

export const LOCALE_MAX_AGE = 365 * 24 * 60 * 60;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/** Endonym, so a speaker of each language recognises their own option. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

/** BCP-47 tag for Intl formatters and <html lang>. */
export const INTL_LOCALES: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
};

export type InltLocale = string;

export const DEFAULT_INTL_LOCALE = INTL_LOCALES[DEFAULT_LOCALE];
