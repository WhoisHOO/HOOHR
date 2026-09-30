export const LOCALES = ["ko", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

/** Narrows an untrusted string (CLI flag, form value) to a Locale. */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/** BCP-47 tag for Intl formatters and <html lang>. */
export const INTL_LOCALES: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
};

export type InltLocale = string;

export const DEFAULT_INTL_LOCALE = INTL_LOCALES[DEFAULT_LOCALE];
