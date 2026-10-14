// Shared helper: the UI language is a per-browser cookie, flipped with the
// sidebar's 한국어/English switcher. Suites that assert against English copy
// therefore switch to English up front and switch back when they are done.
//
// Kept in one place because the mechanics are easy to get subtly wrong:
//
//   * the sidebar footer holds TWO forms (locale switcher, then logout), so a
//     bare `aside form button[type=submit]` clicks whichever comes first;
//     sign-out must pick the button WITHOUT a name attribute;
//   * the locale buttons carry name="locale", so they are found by value;
//   * after the switch the whole app re-renders server-side, so wait before
//     asserting.

// The install generates its own admin password into .env, so a hardcoded default
// only ever worked on a database that had never been recreated. Read .env here
// so `npm run test:e2e` works without the caller exporting anything, and so all
// three suites agree on which account they are driving.
import { readFileSync } from "node:fs";
import { waitForReact, sleep } from "./cdp.mjs";

function envValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const line = readFileSync(new URL("../.env", import.meta.url), "utf-8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    if (!line) return undefined;
    return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

export const E2E_EMAIL = envValue("E2E_EMAIL") || envValue("BOOTSTRAP_ADMIN_EMAIL") || "admin@example.com";
export const E2E_PASSWORD = envValue("E2E_PASSWORD") || envValue("BOOTSTRAP_ADMIN_PASSWORD") || "Admin1234!";

/** The language the app is actually rendering in. */
export async function currentLanguage(page) {
  return page.eval("return document.documentElement.lang;");
}

export async function isEnglish(page) {
  return (await currentLanguage(page)) === "en";
}

/** Clicks the sidebar locale switcher. Returns true once the UI followed. */
export async function setLocale(page, base, code) {
  await page.goto(`${base}/hoohr`);
  await waitForReact(page, "aside");
  const clicked = await page.eval(`
    const btn = document.querySelector('aside button[name="locale"][value=${JSON.stringify(code)}]');
    if (!btn) return "NO_BUTTON";
    btn.click();
    return "CLICKED";
  `);
  if (clicked !== "CLICKED") return false;
  await sleep(2500);
  if ((await currentLanguage(page)) !== code) return false;
  const cookie = (await page.cookies()).find((c) => c.name === "locale");
  return cookie?.value === code;
}

/** Signs out through the sidebar logout form, whatever the UI language is. */
export async function signOut(page, base) {
  const clicked = await page.eval(`
    const btn = document.querySelector('aside button[type="submit"]:not([name])');
    if (!btn) return null;
    btn.click();
    return 1;
  `);
  await sleep(2500);
  return clicked === 1 && !(await page.url()).startsWith(`${base}/hoohr`);
}
