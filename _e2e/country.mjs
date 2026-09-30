// Shared helper: the UI language is the company's country, and there is no
// switcher to click. Suites that assert against English copy therefore have to
// put the company in the US, and put it back when they are done.
//
// Kept in one place because the mechanics are easy to get subtly wrong:
//
//   * the Settings page renders ~33 <form> elements and the very first one in
//     the DOM is the sidebar's sign-out, so a bare `form button[type=submit]`
//     quietly logs you out instead of saving;
//   * a <select> assigned through `.value =` does not reach React, it has to go
//     through the prototype's value setter and a change event;
//   * the sign-out control has to be found by position, not by its label,
//     because the label is in the language being switched away from.

import { readFileSync } from "node:fs";
import { waitForReact, sleep } from "./cdp.mjs";

// The install generates its own admin password into .env, so a hardcoded default
// only ever worked on a database that had never been recreated. Read .env here
// so `npm run test:e2e` works without the caller exporting anything, and so all
// three suites agree on which account they are driving.
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

/** Admin only. Sets the company country and saves. Returns true on success. */
export async function setCountry(page, base, code) {
  await page.goto(`${base}/hoohr/admin/settings`);
  await waitForReact(page, "#company-country");
  const changed = await page.eval(`
    const sel = document.querySelector('#company-country');
    if (!sel) return "NO_SELECT";
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sel), "value");
    d.set.call(sel, ${JSON.stringify(code)});
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.form.querySelector('button[type="submit"]') ? sel.value : "NO_SUBMIT";
  `);
  if (changed !== code) return false;

  await page.eval(`
    document.querySelector('#company-country').form
      .querySelector('button[type="submit"]').click();
    return 1;
  `);
  await sleep(3000);
  return (await currentLanguage(page)) === (code === "US" ? "en" : "ko");
}

/** Signs out through the sidebar form, whatever the UI language is. */
export async function signOut(page, base) {
  const clicked = await page.eval(`
    const form = document.querySelector("aside form");
    if (!form) return null;
    form.querySelector('button[type="submit"]').click();
    return 1;
  `);
  await sleep(2500);
  return clicked === 1 && !(await page.url()).startsWith(`${base}/hoohr`);
}
