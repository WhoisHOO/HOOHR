"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dict } from "./dictionaries";
import { interpolate } from "./format";

type I18nValue = {
  locale: Locale;
  d: Dict;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({
  locale,
  d,
  children,
}: {
  locale: Locale;
  d: Dict;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, d }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside <LocaleProvider>");
  }
  return value;
}

export { interpolate };
export { LOCALE_LABELS, INTL_LOCALES } from "./config";
export type { Locale } from "./config";
