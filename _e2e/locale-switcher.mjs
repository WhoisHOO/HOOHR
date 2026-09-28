// End-to-end check of the runtime locale switcher, driven through a real
// browser. This is the one flow curl cannot reach: setLocale is a Next.js
// server action, and POSTing one by hand gets a 500 "Connection closed."
// So the cookie is only verifiable by actually clicking the control.
//
// Requires the dev server on E2E_BASE (default http://localhost:3000).
//   npm run dev            # in one terminal
//   npm run test:e2e       # in another
//
// The credential defaults to the public seed admin. Override for a real
// account with E2E_EMAIL / E2E_PASSWORD.

import { launch, connect, sleep } from "./cdp.mjs";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL || "admin@example.com";
const PASSWORD = process.env.E2E_PASSWORD || "Admin1234!";
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

try {
  const probe = await fetch(`${BASE}/login`, { method: "GET" }).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`dev server not reachable at ${BASE} - start it with: npm run dev`);
    process.exit(1);
  }
} catch {}

const browser = await launch({ port: PORT, headless: HEADLESS });
console.log("browser:", browser.version, "\n");

try {
  const cdp = await connect(PORT);
  const page = await cdp.newPage();

  // ---------- 1. login form, driven like a real user ----------
  await page.goto(`${BASE}/login`);
  check("login page loads", (await page.url()).includes("/login"));

  await page.eval(`
    const set = (el, v) => {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc.set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const email = document.querySelector('input[name="email"]');
    const pass_ = document.querySelector('input[name="password"]');
    set(email, ${JSON.stringify(EMAIL)});
    set(pass_, ${JSON.stringify(PASSWORD)});
    return [email.value, pass_.value.length];
  `);
  const filled = await page.eval(`
    return [document.querySelector('input[name="email"]').value,
            document.querySelector('input[name="password"]').value.length];
  `);
  check("React accepts typed credentials", filled[0] === EMAIL && filled[1] === PASSWORD.length, JSON.stringify(filled));

  await page.eval(`document.querySelector('button[type="submit"]').click(); return 1;`);
  await sleep(2500);

  const afterLogin = await page.url();
  check("login redirects into the app", afterLogin.startsWith(`${BASE}/hoohr`), afterLogin.replace(BASE, ""));

  // ---------- 2. default locale is Korean ----------
  const koText = await page.text();
  check("dashboard renders Korean by default", koText.includes("출근") || koText.includes("대시보드"), "");

  const koCookies = await page.cookies();
  const koLocale = koCookies.find((c) => c.name === "locale");
  check("no locale cookie set by default (Korean is the default)", !koLocale, koLocale ? koLocale.value : "");

  // ---------- 3. CLICK the switcher to English (server action) ----------
  const clicked = await page.eval(`
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    const el = nodes.find((n) => (n.textContent || "").trim() === "English");
    if (!el) return null;
    el.click();
    return el.textContent.trim();
  `);
  check("locale switcher offers an English control", clicked === "English", String(clicked));
  await sleep(3000);

  // ---------- 4. the server action wrote the cookie ----------
  const enCookies = await page.cookies();
  const enLocale = enCookies.find((c) => c.name === "locale");
  check("setLocale server action wrote locale=en", enLocale?.value === "en", enLocale ? enLocale.value : "MISSING");
  check("locale cookie is httpOnly", enLocale?.httpOnly === true, `httpOnly=${enLocale?.httpOnly}`);
  check("locale cookie path is /", enLocale?.path === "/", `path=${enLocale?.path}`);

  // ---------- 5. the UI actually switched ----------
  const enText = await page.text();
  check("dashboard switched to English", enText.includes("Dashboard") && enText.includes("Sign out"), "");
  check("no longer showing Korean nav", !enText.includes("대시보드") || enText.includes("Dashboard"), "");

  // ---------- 6. it PERSISTS across a full reload ----------
  await page.goto(`${BASE}/hoohr`);
  const afterReload = await page.text();
  check("English survives a hard reload", afterReload.includes("Dashboard") && afterReload.includes("Sign out"), "");

  await page.goto(`${BASE}/hoohr/leave`);
  const leaveEn = await page.text();
  check("navigating to another page stays English", leaveEn.includes("Request leave") || leaveEn.includes("Leave"), "");

  await page.goto(`${BASE}/hoohr/expenses`);
  const expEn = await page.text();
  check("expenses page is English", expEn.includes("Expense"), "");

  // ---------- 7. switch back to Korean ----------
  const backClicked = await page.eval(`
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    const el = nodes.find((n) => (n.textContent || "").trim() === "한국어");
    if (!el) return null;
    el.click();
    return el.textContent.trim();
  `);
  check("can switch back to 한국어", backClicked === "한국어", String(backClicked));
  await sleep(3000);

  const backCookies = await page.cookies();
  const backLocale = backCookies.find((c) => c.name === "locale");
  check("locale cookie flipped to ko", backLocale?.value === "ko", backLocale ? backLocale.value : "MISSING");

  await page.goto(`${BASE}/hoohr`);
  const backText = await page.text();
  check("UI is Korean again after reload", backText.includes("대시보드") || backText.includes("출근"), "");

  // ---------- 8. <html lang> follows the locale ----------
  await page.eval(`
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    const el = nodes.find((n) => (n.textContent || "").trim() === "English");
    if (el) el.click();
    return 1;
  `);
  await sleep(2500);
  const lang = await page.eval("return document.documentElement.lang;");
  check("<html lang> is set to en", lang === "en", `lang=${lang}`);

  // ---------- 9. log out works in the browser too ----------
  const outClicked = await page.eval(`
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    const el = nodes.find((n) => (n.textContent || "").includes("Sign out"));
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
