// End-to-end check of the expense flow, driven through a browser.
//
// This is the least-tested layer in the project. _test-expense.ts writes every
// status transition straight to the database with Prisma, so it proves the
// schema works and nothing else: createExpenseReport, submitExpenseReport,
// decideExpense and deleteExpenseReport have never been called by anything. Its
// "guard check" step is the clearest example -- it logs that a report is PAID and
// calls that a check, without ever invoking the action that would refuse it.
//
// The status transitions the UI depends on all live in those actions, so a
// regression there would be invisible to every existing test. This suite walks
// the whole lifecycle through the real forms.
//
// Two accounts are needed and only one is seeded, for reasons that are policy
// rather than accident -- see _e2e/expense-fixture.ts. The report is owned by a
// MANAGER and reviewed by the seeded admin.
//
// Asserts only against English copy, for the same two reasons as forms.mjs: it
// keeps Korean literals out of a file that has been corrupted by an encoding
// round-trip before, and it cross-checks the non-default locale.
//
// Requires the dev server:
//   npm run dev                   # in one terminal
//   npm run test:e2e:expenses     # in another
//
// Self-cleaning: _e2e/expense-fixture.ts removes the reports and the manager,
// and also runs first so an interrupted run cannot poison the next one.

import { launch, connect, sleep, waitForReact } from "./cdp.mjs";
import { E2E_PASSWORD, E2E_EMAIL, setCountry, isEnglish, signOut as signOutAny } from "./country.mjs";

// Base-scoped wrappers, so the call sites below stay as readable as before.
const signOut = (page) => signOutAny(page, BASE);
// Not named use*: eslint's rules-of-hooks flags any use-prefixed call at top level.
const changeCountry = (page, code) => setCountry(page, BASE, code);
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const ADMIN_EMAIL = E2E_EMAIL;
const ADMIN_PASSWORD = E2E_PASSWORD;
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "e2e-manager@example.com";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "E2eManager1234!";
const PORT = Number(process.env.E2E_PORT || 9224);
const HEADLESS = process.env.E2E_HEADFUL !== "1";

const MARKER = "E2E-EXPENSE-HARNESS";
const REJECTED_TITLE = `${MARKER} rejected`;
const PAID_TITLE = `${MARKER} paid`;

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

function fixture(mode) {
  const label = mode === "cleanup" ? "post-run cleanup" : "pre-run sweep";
  // tsx via the current node binary: on Windows `npx` is a .cmd shim, so
  // spawnSync("npx", ...) fails with ENOENT without shell:true.
  const tsxCli = join(HERE, "..", "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(process.execPath, [tsxCli, join(HERE, "expense-fixture.ts"), mode], {
    encoding: "utf-8",
    env: { ...process.env, E2E_EMAIL: ADMIN_EMAIL },
  });
  const line = (r.stdout || "").trim().split("\n").pop() || "";
  const err =
    (r.stderr || "").trim().split("\n").filter((l) => l && !l.includes("injected env")).pop() || "";
  console.log(`  ${label}: ${line || err || "no output"}`);
  return { code: r.status, out: line || err };
}

// React tracks its own values, so a plain el.value = x is ignored. The value
// has to go through the native prototype setter and announce itself.
const FILL = `
  const set = (el, v) => {
    if (!el) return false;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    desc.set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
`;

// Returns the innerText of the <li> inside the section whose heading matches,
// so the same title cannot be found in the wrong list.
//
// This must be an IIFE *expression*, not statements. page.eval wraps the body as
// `(() => { ... })()`, so `return \n const sec = ...` is silently rewritten to
// `return;` by automatic semicolon insertion: no SyntaxError, just undefined.
const FIND_IN_SECTION = (headingRe, title) => `(() => {
  const sec = [...document.querySelectorAll("section")]
    .find((s) => new RegExp(${JSON.stringify(headingRe)}).test(s.querySelector("h2")?.textContent || ""));
  if (!sec) return null;
  const li = [...sec.querySelectorAll("li")]
    .find((n) => (n.innerText || "").includes(${JSON.stringify(title)}));
  return li ? li.innerText : null;
})()`;

const HEADINGS = {
  mine: "^My expense reports$",
  inbox: "^Expenses awaiting approval",
  payQueue: "^Awaiting payment",
};

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await waitForReact(page, 'input[name="email"]');
  await page.eval(`
    ${FILL}
    set(document.querySelector('input[name="email"]'), ${JSON.stringify(email)});
    set(document.querySelector('input[name="password"]'), ${JSON.stringify(password)});
    document.querySelector('button[type="submit"]').click();
    return 1;
  `);
  await sleep(2500);
  return (await page.url()).startsWith(`${BASE}/hoohr`);
}

// The UI renders in the company's country - there is no language switcher any
// more. These assertions are all written against the English labels, so the
// suite pins the company to US for its duration and restores KR at the end.
// The mechanics live in ./country.mjs.


// Fills the "new expense report" form and submits it. The form is a controlled
// client component, so revalidatePath does not reset it: the caller has to clear
// the fields when creating a second report.
async function createReport(page, title, rows) {
  await page.goto(`${BASE}/hoohr/expenses`);
  await waitForReact(page, 'input[name="title"]');

  await page.eval(`
    ${FILL}
    set(document.querySelector('input[name="title"]'), ${JSON.stringify(title)});
    return 1;
  `);

  // Grow the row list to the requested size, then fill each row.
  for (let i = 1; i < rows.length; i++) {
    await page.eval(`
      const b = [...document.querySelectorAll("button[type=button]")]
        .find((n) => /Add item/.test(n.textContent || ""));
      if (!b) return null;
      b.click();
      return 1;
    `);
    await sleep(400);
  }

  const rowCount = await page.eval(`
    ${FILL}
    const dates = document.querySelectorAll('input[name="item_date"]');
    const cats = document.querySelectorAll('select[name="item_categoryId"]');
    const amts = document.querySelectorAll('input[name="item_amount"]');
    const descs = document.querySelectorAll('input[name="item_description"]');
    const rows = ${JSON.stringify(rows)};
    if (dates.length !== rows.length) return dates.length;
    rows.forEach((r, i) => {
      set(cats[i], cats[i].options[0].value);
      set(amts[i], r.amount);
      set(descs[i], r.description);
    });
    return dates.length;
  `);
  if (rowCount !== rows.length) {
    console.log(`  (row count mismatch: wanted ${rows.length}, found ${rowCount})`);
  }

  // The live total is client-side only, so this is a real assertion about the
  // form, not a read-back of what the action stored.
  const total = await page.eval(`
    const m = document.body.innerText.match(/Total:\\s*\\$([0-9,]+\\.[0-9]{2})/);
    return m ? m[1] : "";
  `);

  const clicked = await page.eval(`
    const form = document.querySelector('input[name="title"]').closest("form");
    if (!form) return null;
    const btn = [...form.querySelectorAll('button[type="submit"]')]
      .find((b) => /Create report/.test(b.textContent || ""));
    if (!btn) return null;
    btn.click();
    return btn.textContent.trim();
  `);
  await sleep(4000);

  // The action reports its outcome in the form. Capture it so a failure says
  // why instead of leaving only "the report is not in the list".
  const message = await page.eval(`
    const form = document.querySelector('input[name="title"]').closest("form");
    const p = [...(form?.querySelectorAll("p") || [])]
      .find((x) => /bg-(green|red)-50/.test(x.className));
    return p ? (p.innerText || "").trim() : "";
  `);
  return { total, clicked, message, rowCount };
}

const probe = await fetch(`${BASE}/login`).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`dev server not reachable at ${BASE} - start it with: npm run dev`);
  process.exit(1);
}

fixture("setup");

const browser = await launch({ port: PORT, headless: HEADLESS });
console.log("browser:", browser.version, "\n");

try {
  const cdp = await connect(PORT);
  const page = await cdp.newPage();

  // =====================================================================
  // Pin the language. The UI renders in the company's country, so to assert
  // against the English labels below the company is set to US first.
  // =====================================================================
  check("admin signed in to set the country", await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD), await page.url());
  check("company country set to US", await changeCountry(page, "US"), "");
  check("the UI is now English", await isEnglish(page), "");
  check("admin signed out again", await signOut(page), await page.url());

  // =====================================================================
  // As the MANAGER (the report owner)
  // =====================================================================
  check("manager signed in", await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD), await page.url());
  check("the manager sees the same language", await isEnglish(page), "");

  await page.goto(`${BASE}/hoohr/expenses`);
  await waitForReact(page, 'input[name="title"]');
  const cat = await page.eval(`
    const sel = document.querySelector('select[name="item_categoryId"]');
    if (!sel || !sel.options.length) return null;
    return { count: sel.options.length, label: sel.options[0].text.trim() };
  `);
  check("expense category dropdown is populated", !!cat && cat.count > 0, JSON.stringify(cat));

  // A manager is not an admin, so the pay queue must not be rendered at all.
  const noPayQueue = await page.eval(`
    return !/Awaiting payment/.test(document.body.innerText);
  `);
  check("a manager is not offered the payment queue", noPayQueue === true, "");

  // ---- report 1: create with two items, then reject it later ----
  const r1 = await createReport(page, REJECTED_TITLE, [
    { amount: "12.50", description: "taxi" },
    { amount: "8.00", description: "bus" },
  ]);
  check("two item rows were filled",
    r1.rowCount === 2 && r1.clicked === "Create report" && /has been created/.test(r1.message),
    `rows=${r1.rowCount} clicked=${r1.clicked} msg=${r1.message}`);
  check("live total sums both items", r1.total === "20.50", `total=$${r1.total}`);

  const draft = await page.eval(`return ${FIND_IN_SECTION(HEADINGS.mine, REJECTED_TITLE)};`);
  check("the new report is listed as a draft", !!draft && /In progress/.test(draft), String(draft).slice(0, 90));
  // The items heading carries a CSS `uppercase` class and innerText reflects
  // text-transform, so this has to be case-insensitive.
  check("both items are shown under the report", !!draft && /items\s*\(2\)/i.test(draft), "");

  const draftCtas = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)}));
    if (!li) return null;
    const labels = [...li.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
    return labels;
  `);
  check("a draft offers Submit for approval and Delete",
    Array.isArray(draftCtas) && draftCtas.includes("Submit for approval") && draftCtas.includes("Delete"),
    JSON.stringify(draftCtas));

  const submitted = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)}));
    const b = [...(li?.querySelectorAll("button") || [])]
      .find((x) => (x.textContent || "").trim() === "Submit for approval");
    if (!b) return null;
    b.click();
    return b.textContent.trim();
  `);
  check("draft submitted for approval", submitted === "Submit for approval", String(submitted));
  await sleep(3500);

  const afterSubmit = await page.eval(`return ${FIND_IN_SECTION(HEADINGS.mine, REJECTED_TITLE)};`);
  check("the report now reads Awaiting approval", !!afterSubmit && /Awaiting approval/.test(afterSubmit),
    String(afterSubmit).slice(0, 90));
  const ctasGone = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)}));
    if (!li) return null;
    return [...li.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
  `);
  check("a submitted report no longer offers edit controls", Array.isArray(ctasGone) && ctasGone.length === 0,
    JSON.stringify(ctasGone));

  // ---- report 2: create and submit, to be approved and paid ----
  const r2 = await createReport(page, PAID_TITLE, [{ amount: "40.00", description: "hotel" }]);
  check("second report created",
    r2.rowCount === 1 && r2.clicked === "Create report" && r2.total === "40.00" && /has been created/.test(r2.message),
    `rows=${r2.rowCount} total=$${r2.total} msg=${r2.message}`);

  await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(PAID_TITLE)}));
    const b = [...(li?.querySelectorAll("button") || [])]
      .find((x) => (x.textContent || "").trim() === "Submit for approval");
    if (!b) return null;
    b.click();
    return 1;
  `);
  await sleep(3500);
  const bothSubmitted = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const t = sec?.innerText || "";
    return {
      a: t.includes(${JSON.stringify(REJECTED_TITLE)}),
      b: t.includes(${JSON.stringify(PAID_TITLE)}),
    };
  `);
  check("both reports are listed", bothSubmitted.a && bothSubmitted.b, JSON.stringify(bothSubmitted));

  // ---- delete a draft, which is the only status where Delete is offered ----
  const delTitle = `${MARKER} deleted`;
  await createReport(page, delTitle, [{ amount: "5.00", description: "temp" }]);
  const delClicked = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(delTitle)}));
    const b = [...(li?.querySelectorAll("button") || [])]
      .find((x) => (x.textContent || "").trim() === "Delete");
    if (!b) return null;
    b.click();
    return 1;
  `);
  check("draft delete clicked", delClicked === 1, String(delClicked));
  await sleep(3500);
  const goneAfterDelete = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^My expense reports$/.test(s.querySelector("h2")?.textContent || ""));
    return !(sec?.innerText || "").includes(${JSON.stringify(delTitle)});
  `);
  check("the deleted draft is gone", goneAfterDelete === true, "");

  // =====================================================================
  // As the seeded ADMIN (the reviewer)
  // =====================================================================
  check("manager signed out", await signOut(page), await page.url());
  check("admin signed in", await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD), await page.url());
  check("admin sees the same language", await isEnglish(page), "");

  await page.goto(`${BASE}/hoohr/expenses`);
  await sleep(2000);
  const inboxHeading = await page.eval(`
    const m = document.body.innerText.match(/Expenses awaiting approval \\((\\d+)\\)/);
    return m ? m[1] : "";
  `);
  check("both reports are in the admin approval inbox", inboxHeading === "2", `inbox=${inboxHeading}`);

  // Rejecting without a reason must be refused: decideExpense requires a
  // comment of at least 2 characters, and this has never been exercised.
  const rejectNoReason = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^Expenses awaiting approval/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)}));
    const b = [...(li?.querySelectorAll("button") || [])]
      .find((x) => (x.textContent || "").trim() === "Reject");
    if (!b) return null;
    b.click();
    return 1;
  `);
  check("reject clicked without a reason", rejectNoReason === 1, String(rejectNoReason));
  await sleep(3000);
  const guardMsg = await page.eval(`
    return /A reason is required when rejecting\\./.test(document.body.innerText);
  `);
  check("rejecting without a reason is refused", guardMsg === true, "");

  const stillIn = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^Expenses awaiting approval/.test(s.querySelector("h2")?.textContent || ""));
    return !!(sec?.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)});
  `);
  check("the report is still pending after the refused reject", stillIn === true, "");

  // Now reject it properly.
  const REJECT_COMMENT = "missing receipt";
  const rejectClicked = await page.eval(`
    ${FILL}
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^Expenses awaiting approval/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(REJECTED_TITLE)}));
    if (!li) return null;
    set(li.querySelector('input[name="comment"]'), ${JSON.stringify(REJECT_COMMENT)});
    const b = [...li.querySelectorAll("button")]
      .find((x) => (x.textContent || "").trim() === "Reject");
    if (!b) return null;
    b.click();
    return 1;
  `);
  check("reject clicked with a reason", rejectClicked === 1, String(rejectClicked));
  await sleep(3500);

  const approveOther = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^Expenses awaiting approval/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(PAID_TITLE)}));
    if (!li) return null;
    const b = [...li.querySelectorAll("button")]
      .find((x) => (x.textContent || "").trim() === "Approve");
    if (!b) return null;
    b.click();
    return 1;
  `);
  check("approve clicked", approveOther === 1, String(approveOther));
  await sleep(3500);

  const payHeading = await page.eval(`
    const m = document.body.innerText.match(/Awaiting payment \\(approved\\) \\((\\d+)\\)/);
    return m ? m[1] : "";
  `);
  check("the approved report moved to the payment queue", payHeading === "1", `payQueue=${payHeading}`);

  const paid = await page.eval(`
    const sec = [...document.querySelectorAll("section")]
      .find((s) => /^Awaiting payment/.test(s.querySelector("h2")?.textContent || ""));
    const li = [...(sec?.querySelectorAll("li") || [])]
      .find((n) => (n.innerText || "").includes(${JSON.stringify(PAID_TITLE)}));
    if (!li) return null;
    const b = [...li.querySelectorAll("button")]
      .find((x) => /Confirm payment/.test(x.textContent || ""));
    if (!b) return null;
    b.click();
    return 1;
  `);
  check("payment confirmed", paid === 1, String(paid));
  await sleep(3500);

  // The decisions land on the owner's view, so verify them there.
  await signOut(page);
  await signIn(page, MANAGER_EMAIL, MANAGER_PASSWORD);
  check("owner still sees English", await isEnglish(page), "");
  await page.goto(`${BASE}/hoohr/expenses`);
  await sleep(2000);

  const rejected = await page.eval(`return ${FIND_IN_SECTION(HEADINGS.mine, REJECTED_TITLE)};`);
  check("the rejected report reads Rejected", !!rejected && /Rejected/.test(rejected), String(rejected).slice(0, 90));
  check("the rejection reason is shown to the owner",
    !!rejected && rejected.includes(`Rejection reason: ${REJECT_COMMENT}`), "");

  const paidRow = await page.eval(`return ${FIND_IN_SECTION(HEADINGS.mine, PAID_TITLE)};`);
  check("the paid report reads Paid", !!paidRow && /\bPaid\b/.test(paidRow), String(paidRow).slice(0, 90));

  // The CSV export is a locale-aware GET route, so the English UI has to
  // produce English column headers.
  const csv = await page.eval(`
    return (async () => {
      const d = new Date();
      const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const r = await fetch("/hoohr/expenses/export?month=" + m);
      const t = await r.text();
      return { status: r.status, header: t.split("\\n")[0].replace(/^\\uFEFF/, "").trim() };
    })();
  `);
  check("CSV export responds", csv.status === 200, `status=${csv.status}`);
  check("CSV headers follow the English locale",
    csv.header === "Date,Category,Employee,Title,Status,Amount,Currency,Description,Receipts", csv.header);

  // Leave the install the way it was found: this suite is allowed to change the
  // country, but only for its own duration.
  await signOut(page);
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  check("country restored to KR", await changeCountry(page, "KR"), "");
  check("the UI is Korean again", !(await isEnglish(page)), "");

  await cdp.close();
} finally {
  await browser.close();
  const c = fixture("cleanup");
  check("fixtures removed", c.code === 0, c.out);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
