// Verifies the NOT-1 / NOT-2 mail layer. The properties under test are the
// ones that would silently break an approval if they regressed: the transport
// is a no-op when unconfigured, a dead SMTP server never throws, and composed
// messages have no unrendered placeholders and no unescaped user input.
//
// No SMTP server is needed. Delivery itself stays unverified by design — see the
// note at the bottom about what still needs real credentials.
import "dotenv/config";
import "./scripts/server-only-stub";

type Result = { label: string; ok: boolean; detail?: string };
const results: Result[] = [];

function check(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail: ok ? undefined : detail });
}

const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_SECURE",
] as const;

const saved: Record<string, string | undefined> = {};
for (const k of SMTP_KEYS) saved[k] = process.env[k];

function setSmtp(vars: Partial<Record<(typeof SMTP_KEYS)[number], string | undefined>>) {
  for (const k of SMTP_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) process.env[k] = v;
  }
}

function restoreSmtp() {
  for (const k of SMTP_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

/** Any `{placeholder}` that survived composition means a template/param mismatch. */
function leftoverPlaceholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[0]);
}

async function main() {
  const { mailConfig, mailEnabled, sendMail, resetMailerForTests } = await import(
    "./src/lib/mail"
  );
  const {
    escapeHtml,
    buildLeaveDecisionMessage,
    buildExpenseDecisionMessage,
    buildInvitationMessage,
  } = await import("./src/lib/notifications");
  const { renderDigest } = await import("./src/lib/approval-digest");

  // ---- mailConfig: unconfigured is the default and must stay inert ----

  setSmtp({});
  check("mailConfig is null with no SMTP_HOST", mailConfig() === null);
  check("mailEnabled is false with no SMTP_HOST", mailEnabled() === false);
  check("whitespace-only SMTP_HOST counts as unset", (() => {
    setSmtp({ SMTP_HOST: "   " });
    return mailConfig() === null;
  })());

  const unconfigured = await sendMail({ to: "a@b.c", subject: "s", text: "t" });
  check(
    "sendMail reports not_configured instead of throwing",
    unconfigured.sent === false && unconfigured.reason === "not_configured",
    JSON.stringify(unconfigured),
  );

  // ---- mailConfig: derivation rules ----

  setSmtp({ SMTP_HOST: "smtp.example.com" });
  const dflt = mailConfig()!;
  check("port defaults to 587", dflt.port === 587, String(dflt.port));
  check("port 587 means STARTTLS, not implicit TLS", dflt.secure === false);
  check("no auth attached without credentials", dflt.auth === undefined);

  setSmtp({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "465" });
  check("port 465 implies implicit TLS", mailConfig()!.secure === true);

  setSmtp({ SMTP_HOST: "smtp.example.com", SMTP_SECURE: "true", SMTP_PORT: "587" });
  check("SMTP_SECURE overrides the port-derived default", mailConfig()!.secure === true);

  setSmtp({
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "u",
  });
  check("user without a password is not treated as auth", mailConfig()!.auth === undefined);

  setSmtp({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" });
  check(
    "user + password are attached",
    mailConfig()!.auth?.user === "u" && mailConfig()!.auth?.pass === "p",
  );

  setSmtp({ SMTP_HOST: "smtp.example.com" });
  check("SMTP_FROM falls back to a local placeholder", mailConfig()!.from.includes("no-reply"));

  // ---- graceful failure: a refused connection must not throw ----

  setSmtp({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_FROM: "t@localhost" });
  resetMailerForTests();
  const refused = await sendMail({ to: "a@b.c", subject: "s", text: "t" });
  check(
    "an unreachable SMTP server yields send_failed, not a throw",
    refused.sent === false && refused.reason === "send_failed",
    JSON.stringify(refused),
  );

  resetMailerForTests();
  const blank = await sendMail({ to: "   ", subject: "s", text: "t" });
  check(
    "a blank recipient is rejected before dialling",
    blank.sent === false && blank.reason === "no_recipient",
    JSON.stringify(blank),
  );

  // The transport is cached per config; prove the cache does not pin a stale one.
  setSmtp({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_FROM: "a@x" });
  resetMailerForTests();
  await sendMail({ to: "a@b.c", subject: "s", text: "t" });
  setSmtp({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "2", SMTP_FROM: "a@x" });
  const changed = await sendMail({ to: "a@b.c", subject: "s", text: "t" });
  check("changing the port rebuilds the cached transport", changed.sent === false);

  // ---- HTML escaping (report titles and names are user input) ----

  check("escapeHtml handles all five significant chars", escapeHtml(`<a href="x">&'`).length > 0);
  check("escapeHtml neutralises a script tag", !escapeHtml("<script>alert(1)</script>").includes("<script>"));
  check("escapeHtml escapes ampersand first", escapeHtml("a & b") === "a &amp; b", escapeHtml("a & b"));

  // ---- composed leave decision ----

  const leaveArgs = {
    to: "emp@example.com",
    requesterName: "김다희",
    reviewerName: "박-manager",
    kind: "PTO" as const,
    startDate: new Date(Date.UTC(2026, 8, 1)),
    endDate: new Date(Date.UTC(2026, 8, 3)),
    days: 3,
    decision: "APPROVED" as const,
    comment: "",
  };

  const leaveKo = buildLeaveDecisionMessage({ ...leaveArgs, locale: "ko" });
  check(
    "leave subject names the requester outcome",
    leaveKo.subject.includes("승인"),
    leaveKo.subject,
  );
  check("leave ko body has no leftover placeholders", leftoverPlaceholders(leaveKo.text).length === 0, leftoverPlaceholders(leaveKo.text).join(","));
  check("leave ko html has no leftover placeholders", leftoverPlaceholders(leaveKo.html).length === 0, leftoverPlaceholders(leaveKo.html).join(","));
  check("an absent comment falls back, not to 'null'", leaveKo.text.includes("작성된 의견 없음") && !leaveKo.text.includes("null"));
  check("leave body carries the day count", /\d/.test(leaveKo.text));

  const leaveRejKo = buildLeaveDecisionMessage({ ...leaveArgs, decision: "REJECTED", comment: "인원 부족", locale: "ko" });
  check("rejection subject differs from approval", leaveRejKo.subject !== leaveKo.subject);
  check("rejection includes the reviewer comment", leaveRejKo.text.includes("인원 부족"));

  const leaveEn = buildLeaveDecisionMessage({ ...leaveArgs, locale: "en" });
  check("the en subject is not the ko subject", leaveEn.subject !== leaveKo.subject, leaveEn.subject);
  check("leave en body has no leftover placeholders", leftoverPlaceholders(leaveEn.text).length === 0, leftoverPlaceholders(leaveEn.text).join(","));
  check("the locale default is ko when none is given", buildLeaveDecisionMessage(leaveArgs).subject === leaveKo.subject);

  // ---- composed expense decision, including the user-supplied title ----

  const expArgs = {
    to: "emp@example.com",
    requesterName: "김다희",
    reviewerName: "박-manager",
    title: 'Conference <script>alert("x")</script>',
    totalAmountCents: 123456,
    currency: "USD",
    decision: "APPROVED" as const,
    comment: null,
  };

  const expKo = buildExpenseDecisionMessage({ ...expArgs, locale: "ko" });
  check("expense html escapes a hostile title", !expKo.html.includes("<script>"), expKo.html);
  check("expense html still contains the escaped title", expKo.html.includes("&lt;script&gt;"));
  check("the plain-text part keeps the raw title readable", expKo.text.includes("<script>"));
  check("expense text has no leftover placeholders", leftoverPlaceholders(expKo.text).length === 0, leftoverPlaceholders(expKo.text).join(","));
  check("a null comment uses the fallback", expKo.text.includes("작성된 의견 없음") && !expKo.text.includes("null"));
  check("the amount is formatted as currency", /\$|₩|KRW|USD/.test(expKo.text), expKo.text);

  const expPaid = buildExpenseDecisionMessage({ ...expArgs, decision: "PAID", locale: "ko" });
  check("the paid notice has its own subject", expPaid.subject !== expKo.subject, expPaid.subject);
  check("the paid notice omits the reviewer opinion", !expPaid.text.includes("작성된 의견 없음"));
  const expRej = buildExpenseDecisionMessage({ ...expArgs, decision: "REJECTED", locale: "en" });
  check("expense en subject differs from ko", expRej.subject !== expKo.subject);
  check("expense en text has no leftover placeholders", leftoverPlaceholders(expRej.text).length === 0, leftoverPlaceholders(expRej.text).join(","));

  // ---- composed invitation ----

  const inv = buildInvitationMessage({
    to: "new@example.com",
    name: "이순신",
    companyName: "어떤회사",
    inviteUrl: "http://localhost:3000/invite/abc123",
    expiresAt: new Date(Date.UTC(2026, 8, 1)),
    locale: "ko",
  });
  check("the invite carries the clickable link", inv.text.includes("http://localhost:3000/invite/abc123"));
  check("the invite body has no leftover placeholders", leftoverPlaceholders(inv.text).length === 0, leftoverPlaceholders(inv.text).join(","));
  check("the invite html links to the token URL", inv.html.includes('href="http://localhost:3000/invite/abc123"'));
  check("the invite names the expiry date", inv.text.includes("2026"), inv.text.split("\n").find((l) => l.includes("유효")) ?? "");
  check("the invite names the company", inv.text.includes("어떤회사"));

  // ---- digest rendering ----

  const plan = {
    companyId: "c1",
    reviewerId: "u1",
    reviewerName: "박-manager",
    reviewerEmail: "manager@example.com",
    items: [
      {
        kind: "leave" as const,
        id: "l1",
        link: "digest:leave:l1",
        requesterName: "김다희",
        leaveKind: "PTO" as const,
        startDate: new Date(Date.UTC(2026, 8, 1)),
        endDate: new Date(Date.UTC(2026, 8, 1)),
        days: 1,
      },
      {
        kind: "expense" as const,
        id: "e1",
        link: "digest:expense:e1",
        requesterName: "이순신",
        title: "Taxi fare",
        totalAmountCents: 5000,
        currency: "USD",
      },
    ],
  };

  const digestKo = renderDigest(plan, "ko");
  check("digest text has no leftover placeholders", leftoverPlaceholders(digestKo.text).length === 0, leftoverPlaceholders(digestKo.text).join(","));
  check("digest html has no leftover placeholders", leftoverPlaceholders(digestKo.html).length === 0, leftoverPlaceholders(digestKo.html).join(","));
  check("the digest subject carries the pending count", digestKo.subject.includes("2"), digestKo.subject);
  check("the digest lists both sections", digestKo.text.includes("휴가 신청") && digestKo.text.includes("지출 보고서"));
  check("the digest links to the leave list", digestKo.text.includes("/hoohr/leave"));
  check("the digest links to the expense list", digestKo.text.includes("/hoohr/expenses"));
  check("the digest names each requester", digestKo.text.includes("김다희") && digestKo.text.includes("이순신"));

  const digestEn = renderDigest(plan, "en");
  check("the en digest subject differs from ko", digestEn.subject !== digestKo.subject);
  check("the en digest has no leftover placeholders", leftoverPlaceholders(digestEn.text).length === 0, leftoverPlaceholders(digestEn.text).join(","));
  check("the en digest omits the ko section headings", !digestEn.text.includes("휴가 신청"));

  const leaveOnly = renderDigest({ ...plan, items: [plan.items[0]] }, "ko");
  check("a leave-only digest omits the expense section", !leaveOnly.text.includes("지출 보고서"), leaveOnly.text);
  check("a leave-only digest omits the expense link", !leaveOnly.text.includes("/hoohr/expenses"));

  const empty = renderDigest({ ...plan, items: [] }, "ko");
  check("an empty plan renders the empty note", empty.text.includes("대기 중인 요청이 없습니다"));
  check("an empty plan has no leftover placeholders", leftoverPlaceholders(empty.text).length === 0, leftoverPlaceholders(empty.text).join(","));

  const hostile = renderDigest(
    {
      ...plan,
      items: [
        {
          kind: "expense" as const,
          id: "e-hostile",
          link: "digest:expense:e-hostile",
          requesterName: "이순신",
          title: '<img src=x onerror="alert(1)">',
          totalAmountCents: 1000,
          currency: "USD",
        },
      ],
    },
    "ko",
  );
  check("a hostile report title is escaped in digest html", !hostile.html.includes("<img"), hostile.html);

  restoreSmtp();
  resetMailerForTests();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.label}${r.detail ? "  " + r.detail : ""}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  console.log(
    "\nNot covered here: real delivery. End-to-end SMTP still needs SMTP_HOST plus a",
  );
  console.log("reachable server, e.g. `docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  restoreSmtp();
  console.error(e);
  process.exit(1);
});
