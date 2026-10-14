// End-to-end check that the UI language is a per-browser choice.
//
// The product decision this file exists to pin down: the screen language is
// picked with the sidebar's 한국어/English switcher and stored in a `locale`
// cookie. It is independent of country, currency and timezone. So the
// guarantees to prove are:
//
//   1. a language switcher exists in the app sidebar
//   2. switching flips the UI and sets the locale cookie
//   3. the language is stable across reloads and across pages
//   4. switching back restores the original language
//
// Driven through a real browser, because a Next.js server action cannot be
// POSTed by hand from curl.
//
// Requires the app on E2E_BASE (default http://localhost:3000).
//   docker compose up -d --build
//   npm run test:e2e
//
// The credential defaults to the public seed admin. Override for a real
// account with E2E_EMAIL / E2E_PASSWORD.

import { launch, connect, sleep, waitForReact } from "./cdp.mjs";
import { E2E_PASSWORD, E2E_EMAIL, setLocale, currentLanguage } from "./country.mjs";

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
const KO = "\uD55C\uAD6D\uC5B4"; // 한국어
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

/** The sidebar language switcher buttons. */
async function switcherLabels(page) {
  return page.eval(`
    const btns = [...document.querySelectorAll('aside button[name="locale"]')];
    return btns.map((b) => b.textContent.trim());
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

  // ---------- 2. the switcher exists ----------
  const labels = await switcherLabels(page);
  check(
    "sidebar offers Korean and English",
    Array.isArray(labels) && labels.includes(KO) && labels.includes(EN),
    JSON.stringify(labels),
  );

  const lang0 = await currentLanguage(page);
  check("<html lang> is set", lang0 === "ko" || lang0 === "en", `lang=${lang0}`);
  const expectKo = lang0 === "ko";
  const signOutText = expectKo ? SIGN_OUT_KO : SIGN_OUT_EN;
  check("sidebar renders in that language", (await page.text()).includes(signOutText), signOutText);

  // ---------- 3. switching flips the UI and sets the cookie ----------
  const other = expectKo ? "en" : "ko";
  check(`language switched to ${other}`, await setLocale(page, BASE, other));

  const lang1 = await currentLanguage(page);
  check("<html lang> followed the switch", lang1 === other, `lang=${lang1} (was ${lang0})`);

  await page.goto(`${BASE}/hoohr`);
  const flippedText = await page.text();
  const flippedSignOut = other === "ko" ? SIGN_OUT_KO : SIGN_OUT_EN;
  check("dashboard re-rendered in the new language", flippedText.includes(flippedSignOut), flippedSignOut);

  // ---------- 4. the language is stable ----------
  await page.goto(`${BASE}/hoohr/leave`);
  await waitForReact(page, "aside");
  check("leave page keeps the language", (await page.text()).includes(flippedSignOut));

  await page.goto(`${BASE}/hoohr/expenses`);
  await waitForReact(page, "aside");
  check("expenses page keeps the language", (await page.text()).includes(flippedSignOut));

  // ---------- 5. and back again ----------
  const original = expectKo ? "ko" : "en";
  check(`language switched back to ${original}`, await setLocale(page, BASE, original));
  check("<html lang> returned", (await currentLanguage(page)) === lang0, `lang=${await currentLanguage(page)}`);

  // ---------- 6. sign out still works ----------
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
