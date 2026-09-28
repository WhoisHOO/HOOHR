"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_MAX_AGE, isLocale } from "./config";

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: LOCALE_MAX_AGE,
    path: "/",
  });
}
