"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale } from "@/i18n/config";

/** Sidebar 한국어/English switch. Cookie first, company country by default. */
export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get("locale");
  if (!isLocale(value)) return;
  (await cookies()).set("locale", value, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
