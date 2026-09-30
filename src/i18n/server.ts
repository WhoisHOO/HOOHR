import "server-only";

import { getCompanyLocale } from "@/lib/company";
import { dictionaries, type Dict } from "./dictionaries";
import type { Locale } from "./config";

/**
 * 화면 언어는 회사의 국가가 정한다 - 사용자가 고르는 별도의 언어 설정은 없다.
 * (설치할 때 국가를 한 번 고르면 통화·시간대와 함께 언어가 따라온다.)
 */
export async function getLocale(): Promise<Locale> {
  return getCompanyLocale();
}

export async function getDict(): Promise<Dict> {
  return dictionaries[await getLocale()];
}

export { interpolate } from "./format";
export { INTL_LOCALES } from "./config";
export type { Locale } from "./config";
