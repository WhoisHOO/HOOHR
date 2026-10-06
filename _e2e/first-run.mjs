// The very first thing a new user sees: no accounts exist, so the app must
// open the setup screen instead of a login wall. The setup form must create
// the first admin through the real browser path, and /setup must become
// unreachable afterwards.
//
// Precondition: the database has zero users (run against a fresh install or
// after truncating "User"/"Employee"). Run with: node _e2e/first-run.mjs

import "dotenv/config";
import { launch, connect, sleep, waitForReact } from "./cdp.mjs";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PORT = Number(process.env.E2E_PORT || 9230);
const HEADLESS = process.env.E2E_HEADFUL !== "1";

const ADMIN_EMAIL = "firstadmin@example.com";
const ADMIN_PASSWORD = "FirstAdmin-2026";

let pass = 0;
const failures = [];
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failures.push(`${label}${detail ? ` -- ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` -- ${detail}` : ""}`);
  }
}

const FILL = `
  const set = (el, v) => {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    desc.set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
`;

async function main() {
  const probe = await fetch(`${BASE}/setup`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`app not reachable at ${BASE} - start it first`);
    process.exit(1);
  }

  const browser = await launch({ port: PORT, headless: HEADLESS });
  console.log("browser:", browser.version, "\n");

  try {
    const cdp = await connect(PORT);
    const page = await cdp.newPage();

    // ---------- a fresh install opens with setup, not login ----------
    await page.goto(`${BASE}/login`);
    await sleep(1200);
    check("/login bounces to /setup when no account exists", (await page.url()).startsWith(`${BASE}/setup`), (await page.url()).replace(BASE, ""));

    // ---------- the setup form renders the brand ----------
    await waitForReact(page, "input[name=email]");
    const html = await page.eval(`return document.body.innerText;`);
    check("the setup form is shown", /회사와 관리자 계정|Create your company/.test(html), "");

    // ---------- submit creates the admin ----------
    await page.eval(`
      ${FILL}
      const cn = document.querySelector('input[name="companyName"]');
      set(cn, "");
      set(cn, "Test Company");
      set(document.querySelector('input[name="name"]'), "First Admin");
      set(document.querySelector('input[name="email"]'), ${JSON.stringify(ADMIN_EMAIL)});
      set(document.querySelector('input[name="password"]'), ${JSON.stringify(ADMIN_PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return 1;
    `);
    await sleep(3000);
    check("setup redirects to /hoohr", (await page.url()).startsWith(`${BASE}/hoohr`), (await page.url()).replace(BASE, ""));

    // ---------- the dashboard coaches the very first admin ----------
    const dash = await page.eval(`return document.body.innerText;`);
    check("dashboard greets the admin", /First Admin/.test(dash), "");
    check("the getting-started checklist is shown", /시작하기|Getting started/.test(dash), "");

    // ---------- /setup is now locked out ----------
    await page.goto(`${BASE}/setup`);
    await sleep(2500);
    check("/setup is closed once an account exists", /\/(login|hoohr)$/.test((await page.url()).replace(BASE, "")), (await page.url()).replace(BASE, ""));

    // ---------- log out, then the new admin can log in again ----------
    await page.goto(`${BASE}/hoohr`);
    await waitForReact(page, "form button[type=submit]");
    await page.eval(`
      const btns = Array.from(document.querySelectorAll('button'));
      const lo = btns.find(b => /로그아웃|Log out|Logout/i.test(b.textContent));
      if (lo) lo.click();
      return 1;
    `);
    await sleep(2000);
    await page.goto(`${BASE}/login`);
    await waitForReact(page, 'input[name="email"]');
    await page.eval(`
      ${FILL}
      set(document.querySelector('input[name="email"]'), ${JSON.stringify(ADMIN_EMAIL)});
      set(document.querySelector('input[name="password"]'), ${JSON.stringify(ADMIN_PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return 1;
    `);
    await sleep(2500);
    check("the created admin can log in", (await page.url()).startsWith(`${BASE}/hoohr`), (await page.url()).replace(BASE, ""));
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
