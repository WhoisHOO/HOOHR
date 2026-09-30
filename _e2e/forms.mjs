// End-to-end check of the real forms, driven through a browser.
//
// These flows have never been tested interactively. Every earlier round went
// straight to the database (_test-*.ts) or checked the rendered HTML over curl,
// so the wiring between a controlled React input and the server action was
// never exercised. A page can render perfectly and its submit button can still
// be broken.
//
// The assertions below run against English copy. That is deliberate: it keeps
// Korean string literals out of this file, where a stray encoding round-trip can
// silently corrupt them (a PowerShell Get-Content/WriteAllText pass already did
// that once), and it cross-checks that the forms work under the non-default
// country too. The suite sets the company to the US up front and restores it
// before it exits.
//
// Requires the dev server:
//   npm run dev               # in one terminal
//   npm run test:e2e:forms    # in another
//
// Self-cleaning: fixtures are removed by _e2e/cleanup.ts, which also runs first
// to sweep anything an interrupted previous run left behind.

import { launch, connect, sleep, waitForReact } from "./cdp.mjs";
import { E2E_PASSWORD, E2E_EMAIL, setCountry, isEnglish } from "./country.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EMAIL = E2E_EMAIL;
const PASSWORD = E2E_PASSWORD;
const PORT = Number(process.env.E2E_PORT || 9223);
const HEADLESS = process.env.E2E_HEADFUL !== "1";
const REASON = "E2E-FORM-HARNESS";

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

function cleanup(label) {
  // Run tsx through the current node binary rather than shelling out to npx:
  // on Windows `npx` is a .cmd shim, so spawnSync("npx", ...) fails with
  // ENOENT unless shell:true is set, which then warns about unescaped args.
  const tsxCli = join(HERE, "..", "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(process.execPath, [tsxCli, join(HERE, "cleanup.ts")], {
    encoding: "utf-8",
    env: { ...process.env, E2E_EMAIL: EMAIL },
  });
  const line = (r.stdout || "").trim().split("\n").pop() || "";
  const err =
    (r.stderr || "").trim().split("\n").filter((l) => l && !l.includes("injected env")).pop() || "";
  console.log(`  ${label}: ${line || err || "no output"}`);
  return { code: r.status, out: line || err };
}

// React keeps its own value tracking, so a plain el.value = x is ignored. The
// value has to go through the native prototype setter and then announce itself
// with an input event.
const FILL = `
  const set = (el, v) => {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    desc.set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
`;

const probe = await fetch(`${BASE}/login`).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`dev server not reachable at ${BASE} - start it with: npm run dev`);
  process.exit(1);
}

cleanup("pre-run sweep");

const browser = await launch({ port: PORT, headless: HEADLESS });
console.log("browser:", browser.version, "\n");

try {
  const cdp = await connect(PORT);
  const page = await cdp.newPage();

  // ---------- login ----------
  await page.goto(`${BASE}/login`);
  await page.eval(`
    ${FILL}
    set(document.querySelector('input[name="email"]'), ${JSON.stringify(EMAIL)});
    set(document.querySelector('input[name="password"]'), ${JSON.stringify(PASSWORD)});
    document.querySelector('button[type="submit"]').click();
    return 1;
  `);
  await sleep(2500);
  check("logged in", (await page.url()).startsWith(`${BASE}/hoohr`), (await page.url()).replace(BASE, ""));

  // ---------- put the UI in English, then assert only English copy ----------
  // The language is the company's country, so this sets the country rather than
  // clicking a switcher. Mechanics in ./country.mjs.
  check("company country set to US", await setCountry(page, BASE, "US"), "");
  check("the UI is now English", await isEnglish(page), "");

  // =====================================================================
  // Leave: request, then cancel
  // =====================================================================
  // Two future weekdays. Format from the LOCAL calendar fields: toISOString()
  // would shift a local-midnight date back a day whenever the machine is ahead
  // of UTC, which silently turns a "future" date into today and gets rejected
  // by the past-date validation.
  const dates = (() => {
    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    const start = fmt(d);
    d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    return [start, fmt(d)];
  })();

  await page.goto(`${BASE}/hoohr/leave`);
  await waitForReact(page, 'select[name="policyId"]');
  const policy = await page.eval(`
    const sel = document.querySelector('select[name="policyId"]');
    if (!sel || !sel.options.length) return null;
    return { count: sel.options.length, label: sel.options[0].text.trim() };
  `);
  check("leave policy dropdown is populated", !!policy && policy.count > 0, JSON.stringify(policy));

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  check("chosen dates are in the future", dates[0] > today, `today=${today} dates=${dates.join("..")}`);

  await page.eval(`
    ${FILL}
    set(document.querySelector('input[name="startDate"]'), ${JSON.stringify(dates[0])});
    set(document.querySelector('input[name="endDate"]'), ${JSON.stringify(dates[1])});
    set(document.querySelector('textarea[name="reason"], input[name="reason"]'), ${JSON.stringify(REASON)});
    return 1;
  `);

  const filled = await page.eval(`
    return {
      start: document.querySelector('input[name="startDate"]').value,
      end: document.querySelector('input[name="endDate"]').value,
      reason: (document.querySelector('textarea[name="reason"]') || {}).value || "",
    };
  `);
  check("the form kept the typed dates and reason",
    filled.start === dates[0] && filled.end === dates[1] && filled.reason === REASON,
    JSON.stringify(filled));

  const preview = await page.eval(`
    const t = document.body.innerText;
    const m = t.match(/Selected:\\s*([0-9]+(?:\\.[0-9]+)?) day\\(s\\)/);
    return m ? m[1] : "";
  `);
  check("live day-count preview shows 2 workdays for 2 weekdays", preview === "2", `preview=${preview}`);

  // The submit button shares its label with the section heading, so scope the
  // click to the form that owns the policy select.
  const submitted = await page.eval(`
    const form = document.querySelector('select[name="policyId"]').closest('form');
    if (!form) return null;
    const btn = [...form.querySelectorAll('button[type="submit"]')]
      .find((b) => /Request leave/.test(b.textContent || ""));
    if (!btn) return null;
    btn.click();
    return btn.textContent.trim();
  `);
  check("leave request submitted", !!submitted, String(submitted));
  await sleep(4000);

  const afterSubmit = await page.text();
  check("the request appears with the reason we typed", afterSubmit.includes(REASON), "");
  check("it is awaiting approval", /Awaiting approval/.test(afterSubmit), "");
  check("the submitted request shows in My leave requests", /My leave requests/.test(afterSubmit), "");

  // Cancel it again through the UI, which exercises the cancel server action.
  const cancelled = await page.eval(`
    const btns = [...document.querySelectorAll('button[type="submit"]')]
      .filter((b) => (b.textContent || "").trim() === "Cancel");
    if (!btns.length) return null;
    btns[0].click();
    return btns.length;
  `);
  check("a Cancel control is offered on the pending request", !!cancelled, `found=${cancelled}`);
  await sleep(3500);

  const afterCancel = await page.text();
  check("the request now reads Canceled", /Canceled/.test(afterCancel), "");

  // Leave the install the way it was found: this suite may change the country,
  // but only for its own duration.
  check("country restored to KR", await setCountry(page, BASE, "KR"), "");
  check("the UI is Korean again", !(await isEnglish(page)), "");

  await cdp.close();
} finally {
  await browser.close();
  const c = cleanup("post-run cleanup");
  check("fixtures removed", c.code === 0, c.out);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
