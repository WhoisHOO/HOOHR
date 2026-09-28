import type { Locale } from "../config";
import { commonKo, commonEn } from "./common";
import { authKo, authEn } from "./auth";
import { navKo, navEn } from "./nav";

const dictKo = { common: commonKo, auth: authKo, nav: navKo };

// Typing the English composition against the Korean shape makes the compiler
// enforce full key parity across the two languages.
const dictEn: typeof dictKo = { common: commonEn, auth: authEn, nav: navEn };

export type Dict = typeof dictKo;

export const dictionaries: Record<Locale, Dict> = {
  ko: dictKo,
  en: dictEn,
};
