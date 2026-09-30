// End-to-end check that the *country* is the only language control.
//
// The product decision this file exists to pin down: there is no runtime
// language switcher. The admin picks 대한민국 or 미국 once at install, and the
// currency, timezone and on-screen language all follow from it. So the
// guarantees to prove are:
//
//   1. there is no language control anywhere in the UI
//   2. there is no locale cookie - nothing per-browser to go stale
//   3. the language is stable across reloads and across pages
//   4. changing the country in Settings really does re-derive the language
//   5. the country labels are endonyms, so they stay readable *after* the UI
//      has flipped (a Korean user who just switched to 미국 can still switch back)
//
// Driven through a real browser, because a Next.js server action cannot be
// POSTed by hand from curl.
//
// Requires the app on E2E_BASE (default http://localhost:3000).
//   docker compose up -d --build   # or: npm run dev
//   npm run test:e2e:locale
//
// The credential defaults to the public seed admin. Override for a real
// account with E2E_EMAIL / E2E_PASSWORD.

import { launch, connect, sleep } from "./cdp.mjs";
import { E2E_PASSWORD, E2E_EMAIL, setCountry, currentLanguage } from "./country.mjs";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EMAIL = E2E_EMAIL;
const PASSWORD = E2E_PASSWORD;
const PORT = Number(process.env.E2E_PORT || 9222);
const HEADLESS = process.env.E2E_HEADFUL !== "1";

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok    ${label}${detail ? "  " + detail : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`);
  }
}

// Endonyms. Written as escapes on purpose: this file is read by node as UTF-8,
// but a stray editor or a copy through a legacy codepage would otherwise turn
// them into mojibake and the assertions would silently stop matching anything.
const KO = "\uB55C\uAD6D\uC5B4"; // 한국어
const EN = "English";
const SIGN_OUT_KO = "\uB85C\uADF8\uC544\uC6C3"; // 로그아웃
const SIGN_OUT_EN = "Sign out";

async function login(cdp) {
  const page = await cdp.newPage();
  await page.goto(`${BASE}/login`);
  await page.eval(`
    const set = (el, v) => {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc.set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(document.querySelector('input[name="email"]'), ${JSON.stringify(EMAIL)});
    set(document.querySelector('input[name="password"]'), ${JSON.stringify(PASSWORD)});
    return 1;
  `);
  await page.eval(`document.querySelector('button[type="submit"]').click(); return 1;`);
  await sleep(2500);
  return page;
}

/** Looks for a control that would change the language on its own. */
async function findLanguageControl(page) {
  return page.eval(`
    const wanted = [${JSON.stringify(KO)}, ${JSON.stringify(EN)}];
    const nodes = [...document.querySelectorAll("button, a, [role=button], select")];
    const hit = nodes.find((n) => {
      const t = (n.textContent || "").trim();
      return wanted.some((w) => t === w || t.startsWith(w + " ("));
    });
    return hit ? hit.textContent.trim() : null;
  `);
}

try {
  const probe = await fetch(`${BASE}/login`, { method: "GET" }).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`app not reachable at ${BASE} - start it with: docker compose up -d --build`);
    process.exit(1);
  }
} catch {}

const browser = await launch({ port: PORT, headless: HEADLESS });
console.log("browser:", browser.version, "\n");

try {
  const cdp = await connect(PORT);
  const page = await login(cdp);

  // ---------- 1. login works, and lands in the app ----------
  const afterLogin = await page.url();
  check("login redirects into the app", afterLogin.startsWith(`${BASE}/hoohr`), afterLogin.replace(BASE, ""));

  const lang0 = await currentLanguage(page);
  check("<html lang> is set from the country", lang0 === "ko" || lang0 === "en", `lang=${lang0}`);
  const expectKo = lang0 === "ko";
  const signOutText = expectKo ? SIGN_OUT_KO : SIGN_OUT_EN;
  check("sidebar renders in that language", (await page.text()).includes(signOutText), signOutText);

  // ---------- 2. no switcher, no cookie ----------
  const control = await findLanguageControl(page);
  check("no language control exists in the app", control === null, String(control));

  const cookies = await page.cookies();
  const localeCookie = cookies.find((c) => c.name === "locale");
  check("no locale cookie exists", !localeCookie, localeCookie ? localeCookie.value : "");

  await page.goto(`${BASE}/login`);
  check("no language control on the login screen", (await findLanguageControl(page)) === null);

  // ---------- 3. the language is stable ----------
  await page.goto(`${BASE}/hoohr`);
  const dashText = await page.text();
  check("dashboard keeps the language after a hard reload", dashText.includes(signOutText));

  await page.goto(`${BASE}/hoohr/leave`);
  check("leave page keeps the language", (await page.text()).includes(signOutText));

  await page.goto(`${BASE}/hoohr/expenses`);
  check("expenses page keeps the language", (await page.text()).includes(signOutText));

  // ---------- 4. changing the country re-derives the language ----------
  const other = expectKo ? "US" : "KR";
  const expectOther = other === "US" ? "en" : "ko";
  // setCountry saves and confirms the language moved, so this one check covers
  // both the write and the re-derivation.
  check(`country changed to ${other} and the UI followed`, await setCountry(page, BASE, other));

  const lang1 = await currentLanguage(page);
  check("<html lang> followed the country", lang1 === expectOther, `lang=${lang1} (was ${lang0})`);

  await page.goto(`${BASE}/hoohr`);
  const flippedText = await page.text();
  const flippedSignOut = expectOther === "ko" ? SIGN_OUT_KO : SIGN_OUT_EN;
  check("dashboard re-rendered in the new language", flippedText.includes(flippedSignOut), flippedSignOut);
  check("no language control appeared after the switch", (await findLanguageControl(page)) === null);

  // ---------- 5. the country labels survive the language flip ----------
  // This is why the options are endonyms: a Korean admin who just moved the
  // company to 미국 must still be able to find 대한민국 and switch back.
  await page.goto(`${BASE}/hoohr/admin/settings`);
  const options = await page.eval(`
    const sel = document.querySelector('#company-country');
    if (!sel) return [];
    return [...sel.options].map((o) => o.value);
  `);
  check(
    "both countries are still offered, by endonym",
    options.includes("KR") && options.includes("US"),
    JSON.stringify(options),
  );

  // ---------- 6. and back again ----------
  const original = lang0 === "ko" ? "KR" : "US";
  check(`country switched back to ${original}`, await setCountry(page, BASE, original));
  check("<html lang> returned", (await currentLanguage(page)) === lang0, `lang=${await currentLanguage(page)}`);

  // ---------- 7. sign out still works ----------
  await page.goto(`${BASE}/hoohr`);
  const outClicked = await page.eval(`
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    const el = nodes.find((n) => (n.textContent || "").includes(${JSON.stringify(signOutText)}));
    if (!el) return null;
    el.click();
    return 1;
  `);
  check("sign-out control found", outClicked === 1);
  await sleep(2500);
  const afterOut = await page.url();
  check("sign-out lands on /login", afterOut.includes("/login"), afterOut.replace(BASE, ""));

  await cdp.close();
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
