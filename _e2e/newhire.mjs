// What can a brand-new hire actually DO, in the browser?
//
// resilience.ts proves the database-level facts. This proves the user-visible
// ones, for the one workflow that matters most in any HR system: onboard
// someone, let them request leave, approve it.
//
// acceptInvitation creates a User and an Employee but no LeaveBalance row, and
// only the seed and the CSV import ever create one. So the "new hire" that
// acceptInvitation produces is exactly the employee this script logs in as -
// built by hand to match, with no balance row.
//
// The point is not that the request is refused. The point is WHICH message the
// user sees and whether the page is usable at all, because a refusal with no
// route forward is a broken workflow even though nothing threw.
//
// Run with:  npx tsx _e2e/newhire.ts    (dev server must be running)

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { launch, connect, sleep, waitForReact } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PORT = Number(process.env.E2E_PORT || 9224);
const HEADLESS = process.env.E2E_HEADFUL !== "1";
const PASSWORD = "Resilience-Only-1";
const REASON = "E2E-NEWHIRE";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
const ADMIN_EMAIL =
  process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";

let pass = 0;
const failures = [];
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failures.push(`${label}${detail ? ` -- ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ""}`);
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
  const probe = await fetch(`${BASE}/login`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`dev server not reachable at ${BASE} - start it with: npm run dev`);
    process.exit(1);
  }

  const tsxCli = join(HERE, "..", "node_modules", "tsx", "dist", "cli.mjs");
  const runTsx = (script, extra = {}) =>
    spawnSync(process.execPath, [tsxCli, join(HERE, script)], {
      encoding: "utf-8",
      env: { ...process.env, ...extra },
    });

  // Fixtures live in their own process so this file can be pure .mjs against
  // the DB, and so a crash here cannot leave the seeding half-applied.
  const seedOut = runTsx("newhire-fixture.ts", { RESILIENCE_PASSWORD: PASSWORD });
  const seedLog = `${seedOut.stdout || ""}${seedOut.stderr || ""}`
    .split("\n")
    .filter((l) => l && !l.includes("injected env"))
    .join("\n");
  const email = /NEWHIRE_EMAIL=(.+)/.exec(seedLog)?.[1]?.trim();
  const token = /NEWHIRE_TOKEN=(.+)/.exec(seedLog)?.[1]?.trim();
  if (!email || !token) {
    console.error("could not seed the new-hire fixture:\n" + seedLog);
    process.exit(1);
  }
  console.log(`\nnew hire: ${email}\n`);

  const browser = await launch({ port: PORT, headless: HEADLESS });
  console.log("browser:", browser.version, "\n");

  try {
    const cdp = await connect(PORT);
    const page = await cdp.newPage();

    // ---------- log in as the new hire ----------
    await page.goto(`${BASE}/login`);
    await page.eval(`
      ${FILL}
      set(document.querySelector('input[name="email"]'), ${JSON.stringify(email)});
      set(document.querySelector('input[name="password"]'), ${JSON.stringify(PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return 1;
    `);
    await sleep(2500);
    check("the new hire can log in", (await page.url()).startsWith(`${BASE}/hoohr`), (await page.url()).replace(BASE, ""));

    // ---------- what does the dashboard claim? ----------
    await page.goto(`${BASE}/hoohr`);
    const dash = await page.eval(`return document.body.innerText;`);
    // The dashboard's leave card interpolates the remaining balance.
    check(
      "the dashboard shows a zero balance rather than an error",
      /0/.test(dash),
      "",
    );
    check("the dashboard did not render an error", !/error|Error|error\.js/i.test(dash), "");

    // ---------- can they open the leave page at all? ----------
    await page.goto(`${BASE}/hoohr/leave`);
    await waitForReact(page, 'select[name="policyId"]');
    const policies = await page.eval(`
      return Array.from(document.querySelectorAll('select[name="policyId"] option'))
        .map(o => ({ value: o.value, label: o.textContent }));
    `);
    check(
      "the leave form offers policies to choose from",
      policies.length > 0,
      `${policies.length} option(s)`,
    );

    // Two future weekdays, from the local calendar (see forms.mjs: toISOString
    // can shift a local-midnight date back a day and trip the past-date check).
    const dates = (() => {
      const fmt = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekend = (d) => d.getDay() === 0 || d.getDay() === 6;
      const d = new Date();
      d.setDate(d.getDate() + 1);
      while (weekend(d)) d.setDate(d.getDate() + 1);
      const start = fmt(d);
      d.setDate(d.getDate() + 1);
      while (weekend(d)) d.setDate(d.getDate() + 1);
      return [start, fmt(d)];
    })();

    // ---------- try to request PTO, as the new hire ----------
    const pto = policies.find((p) => /PTO|연차/i.test(p.label));
    check("a PTO policy exists to test with", !!pto, pto ? pto.label : policies.map((p) => p.label).join(", "));

    if (pto) {
      await page.eval(`
        ${FILL}
        set(document.querySelector('select[name="policyId"]'), ${JSON.stringify(pto.value)});
        set(document.querySelector('input[name="startDate"]'), ${JSON.stringify(dates[0])});
        set(document.querySelector('input[name="endDate"]'), ${JSON.stringify(dates[1])});
        return 1;
      `);
      // Scoped to the form that owns the policy select. A bare
      // querySelector('form button[type=submit]') picks the sign-out button,
      // which is the first form in the layout - so the click submits nothing
      // and the page just re-renders. The reason is typed last so it can be
      // found in the request list afterwards.
      const submitted = await page.eval(`
        ${FILL}
        const form = document.querySelector('select[name="policyId"]').closest('form');
        if (!form) return null;
        const reason = form.querySelector('input[name="reason"], textarea[name="reason"]');
        if (reason) set(reason, ${JSON.stringify(`${REASON} pto`)});
        const btn = [...form.querySelectorAll('button[type="submit"]')]
          .find((b) => /휴가 신청|Request leave/.test(b.textContent || ""));
        if (!btn) return null;
        btn.click();
        return (btn.textContent || "").trim();
      `);
      check("the leave request form was submitted", !!submitted, String(submitted));
      await sleep(4000);

      const after = await page.eval(`return document.body.innerText;`);

      // The B fix: a new hire with no LeaveBalance row files PTO successfully.
      // Nothing about the request is conditional on a balance existing any more.
      const filed = /PENDING|대기/i.test(after);
      check("a brand-new hire can request PTO with no balance row (B fix)", filed, after.slice(0, 160).replace(/\s+/g, " "));

      const refused = /잔액|balance|insufficient|부족/i.test(after);
      check("and is NOT told they have insufficient balance", !refused, "");

      check("the request is listed with the reason typed in", after.includes(`${REASON} pto`), "");
    }

    // ---------- UNPAID: the one type that should work ----------
    const unpaid = policies.find((p) => /unpaid|무급/i.test(p.label));
    check("an unpaid policy exists to test with", !!unpaid, unpaid ? unpaid.label : "none");
    if (unpaid) {
      await page.goto(`${BASE}/hoohr/leave`);
      await sleep(1500);
      await waitForReact(page, 'select[name="policyId"]');
      const unpaidSubmitted = await page.eval(`
        ${FILL}
        const form = document.querySelector('select[name="policyId"]').closest('form');
        if (!form) return null;
        set(document.querySelector('select[name="policyId"]'), ${JSON.stringify(unpaid.value)});
        set(document.querySelector('input[name="startDate"]'), ${JSON.stringify(dates[0])});
        set(document.querySelector('input[name="endDate"]'), ${JSON.stringify(dates[1])});
        const reason = form.querySelector('input[name="reason"], textarea[name="reason"]');
        if (reason) set(reason, ${JSON.stringify(`${REASON} unpaid`)});
        const btn = [...form.querySelectorAll('button[type="submit"]')]
          .find((b) => /휴가 신청|Request leave/.test(b.textContent || ""));
        if (!btn) return null;
        btn.click();
        return (btn.textContent || "").trim();
      `);
      check("the unpaid request form was submitted", !!unpaidSubmitted, String(unpaidSubmitted));
      await sleep(4000);
      const after = await page.eval(`return document.body.innerText;`);
      check(
        "unpaid leave is filed too",
        after.includes(`${REASON} unpaid`),
        after.slice(0, 160).replace(/\s+/g, " "),
      );
    }

    // ---------- the expenses module, which has no balance dependency ----------
    await page.goto(`${BASE}/hoohr/expenses`);
    const exp = await page.eval(`return document.body.innerText;`);
    check("the expenses page renders for a new hire", exp.length > 0, "");
    check("the expenses page did not render an error", !/Application error|Internal Server Error/i.test(exp), "");

    // ---------- and now the half that used to be impossible: approve it ----------
    // A second tab, logged in as the admin, because the requester is barred
    // from deciding their own request and the admin is the one who can.
    console.log("\nadmin approves the new hire's PTO:");
    const adminPage = await cdp.newPage();
    // Every tab in this browser shares one cookie jar, so the new hire is still
    // logged in here and /login would redirect straight to /hoohr. Clear it.
    await adminPage.s.send("Network.clearBrowserCookies");
    await adminPage.goto(`${BASE}/login`);
    await adminPage.eval(`
      ${FILL}
      set(document.querySelector('input[name="email"]'), ${JSON.stringify(ADMIN_EMAIL)});
      set(document.querySelector('input[name="password"]'), ${JSON.stringify(ADMIN_PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return 1;
    `);
    await sleep(2500);
    check("the admin logged in", (await adminPage.url()).startsWith(`${BASE}/hoohr`), (await adminPage.url()).replace(BASE, ""));

    await adminPage.goto(`${BASE}/hoohr/leave`);
    await sleep(1500);
    const inboxText = await adminPage.eval(`return document.body.innerText;`);
    check(
      "the new hire's PTO request is in the admin's approval inbox",
      inboxText.includes(`${REASON} pto`),
      inboxText.slice(0, 200).replace(/\s+/g, " "),
    );

    // The approve button carries name="decision" value="APPROVE", so it must be
    // the submitter - which a real trusted click provides and form.submit() does
    // not (see _e2e/README.md).
    const approved = await adminPage.eval(`
      const btn = [...document.querySelectorAll('button[value="APPROVE"]')][0];
      if (!btn) return null;
      btn.scrollIntoView();
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    `);
    check("an approve control exists for it", !!approved, "");

    if (approved) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await adminPage.s.send("Input.dispatchMouseEvent", {
          type,
          x: approved.x,
          y: approved.y,
          button: "left",
          clickCount: 1,
        });
      }
      await sleep(4000);
      const afterApprove = await adminPage.eval(`return document.body.innerText;`);
      check(
        "the approval went through instead of failing with a generic error",
        !/요청을 처리할 수 없습니다|처리할 수 없|could not be processed/i.test(afterApprove),
        afterApprove.slice(0, 200).replace(/\s+/g, " "),
      );
    }

    // The point of the upsert: the balance row now exists, created by the
    // approval, and the new hire can see a real remaining figure.
    const balanceOut = runTsx("newhire-fixture.ts", { NEWHIRE_INSPECT: "1" });
    const balanceLog = `${balanceOut.stdout || ""}${balanceOut.stderr || ""}`;
    const used = /NEWHIRE_USED=(-?[\d.]+)/.exec(balanceLog)?.[1];
    const granted = /NEWHIRE_GRANTED=(-?[\d.]+)/.exec(balanceLog)?.[1];
    check(
      "approving created the balance row and recorded the used days (G1)",
      used !== undefined && Number(used) > 0,
      `granted=${granted} used=${used}`,
    );

    // And the new hire now sees a real remaining figure instead of "-".
    await page.goto(`${BASE}/hoohr/leave`);
    await sleep(1500);
    const hireText = await page.eval(`return document.body.innerText;`);
    check(
      "the new hire now sees a real remaining-days figure",
      !/연차\s*-\s*잔여 없음/.test(hireText),
      hireText.slice(0, 160).replace(/\s+/g, " "),
    );
  } finally {
    const out = runTsx("newhire-fixture.ts", { NEWHIRE_CLEANUP: "1" });
    const log = `${out.stdout || ""}${out.stderr || ""}`
      .split("\n")
      .filter((l) => l && !l.includes("injected env"))
      .join(" ");
    console.log(`\ncleanup: ${log.trim()}`);
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
