import "server-only";

import { cookies } from "next/headers";
import { getCompanyLocale } from "@/lib/company";
import { dictionaries, type Dict } from "./dictionaries";
import { isLocale, type Locale } from "./config";

/**
 * 화면 언어는 `locale` 쿠키가 정하고, 없으면 회사의 국가(기본값)가 정한다.
 * 쿠키는 사이드바의 한국어/English 전환이 쓴다.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const cookieLocale = (await cookies()).get("locale")?.value;
    if (isLocale(cookieLocale)) return cookieLocale;
  } catch {
    // 요청 밖(스크립트 등)에서는 쿠키가 없으므로 회사 기본값으로 떨어진다.
  }
  return getCompanyLocale();
}

export async function getDict(): Promise<Dict> {
  return dictionaries[await getLocale()];
}

export { interpolate } from "./format";
export { INTL_LOCALES } from "./config";
export type { Locale } from "./config";
