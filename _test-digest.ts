// Verifies NOT-2 against a real database and a real SMTP conversation.
//
// The properties that matter here cannot be checked by a mock, so nothing is
// mocked: an in-process SMTP sink accepts the messages, the digest runs against
// Postgres, and the assertions read the Notification ledger back out.
//
//   * the plan matches the approval inbox (same predicate the pages use)
//   * a first run sends and records one ledger row per (recipient, request)
//   * a second run sends nothing  <- the idempotency the unique index buys
//   * a failed send releases its claim, so the next run retries
//
// Cleanup removes the fixture in both the success and failure paths, including
// on an unexpected throw, because this writes to a shared dev database.
import "dotenv/config";
import "./scripts/server-only-stub";
import net from "net";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "./src/generated/prisma/client";

type Result = { label: string; ok: boolean; detail?: string };
const results: Result[] = [];
function check(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail: ok ? undefined : detail });
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MARKER = "DIGEST-HARNESS";
const MANAGER_EMAIL = "digest-manager@example.com";
const STAFF_EMAIL = "digest-staff@example.com";

// ============ minimal SMTP sink ============
//
// Speaks just enough ESMTP for nodemailer to hand over a message. Notably it
// never advertises STARTTLS, PIPELINING or AUTH, so nodemailer stays in plain
// text and the conversation stays a simple request/response.
type Captured = { from: string; to: string[]; data: string };
type Sink = {
  port: number;
  messages: Captured[];
  close: () => Promise<void>;
};

async function startSink(): Promise<Sink> {
  const messages: Captured[] = [];

  const server = net.createServer((socket) => {
    let inData = false;
    let buf = "";
    let from = "";
    const to: string[] = [];
    let data = "";

    const write = (line: string) => socket.write(line + "\r\n");

    socket.setEncoding("utf8");
    write("220 127.0.0.1 ESMTP digest-harness");

    socket.on("data", (chunk: string) => {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            messages.push({ from, to: [...to], data });
            write("250 2.0.0 Ok: queued");
            to.length = 0;
            data = "";
          } else {
            // A leading dot is the transparency escape; undot it.
            data += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          }
          continue;
        }

        const verb = line.slice(0, 4).toUpperCase();
        if (verb === "EHLO" || verb === "HELO") {
          // Multiline, and deliberately without STARTTLS/PIPELINING/AUTH.
          socket.write("250-127.0.0.1 Hello\r\n250 SIZE 10485760\r\n");
        } else if (verb === "MAIL") {
          from = (line.match(/<([^>]*)>/) ?? [])[1] ?? "";
          write("250 2.1.0 Ok");
        } else if (verb === "RCPT") {
          to.push((line.match(/<([^>]*)>/) ?? [])[1] ?? "");
          write("250 2.1.5 Ok");
        } else if (verb === "DATA") {
          inData = true;
          write("354 End data with <CR><LF>.<CR><LF>");
        } else if (verb === "RSET") {
          from = "";
          to.length = 0;
          write("250 2.0.0 Ok");
        } else if (verb === "NOOP") {
          write("250 2.0.0 Ok");
        } else if (verb === "QUIT") {
          write("221 2.0.0 Bye");
          socket.end();
        } else {
          write("502 5.5.2 Command not implemented");
        }
      }
    });

    socket.on("error", () => {});
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address() as net.AddressInfo;
  return {
    port: addr.port,
    messages,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// ============ fixture ============

async function companyId(): Promise<string> {
  const email =
    process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) throw new Error(`no seeded admin ${email}; run npm run db:seed`);
  return admin.companyId;
}

async function cleanup(cid: string) {
  // Notification cascades from Company but not from a user delete in the way we
  // need, so sweep the ledger by its marker links explicitly.
  await prisma.notification.deleteMany({ where: { link: { startsWith: "digest:" } } });
  await prisma.expenseReport.deleteMany({
    where: { companyId: cid, title: { contains: MARKER } },
  });
  await prisma.leaveRequest.deleteMany({
    where: { companyId: cid, reason: MARKER },
  });
  await prisma.employee.deleteMany({
    where: { companyId: cid, email: { in: [MANAGER_EMAIL, STAFF_EMAIL] } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [MANAGER_EMAIL, STAFF_EMAIL] } } });
}

type Fixture = {
  companyId: string;
  managerUserId: string;
  managerEmployeeId: string;
  policyId: string;
  staffEmployeeId: string;
};

async function setup(): Promise<Fixture> {
  const cid = await companyId();
  await cleanup(cid);

  const passwordHash = await bcrypt.hash("DigestHarness1234!", 10);

  const manager = await prisma.user.create({
    data: {
      companyId: cid,
      email: MANAGER_EMAIL,
      name: "Digest Manager",
      passwordHash,
      role: "MANAGER",
      isActive: true,
    },
  });
  const managerEmployee = await prisma.employee.create({
    data: {
      companyId: cid,
      userId: manager.id,
      name: "Digest Manager",
      email: MANAGER_EMAIL,
      status: "ACTIVE",
    },
  });

  const staff = await prisma.user.create({
    data: {
      companyId: cid,
      email: STAFF_EMAIL,
      name: "Digest Staff",
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
    },
  });
  const staffEmployee = await prisma.employee.create({
    data: {
      companyId: cid,
      userId: staff.id,
      name: "Digest Staff",
      email: STAFF_EMAIL,
      status: "ACTIVE",
      // This is what puts the staff member in the manager's inbox:
      // effectiveApproverId() resolves to leaveApproverId when it is set.
      leaveApproverId: managerEmployee.id,
    },
  });

  const policy =
    (await prisma.leavePolicy.findFirst({
      where: { companyId: cid, kind: "PTO" },
    })) ??
    (await prisma.leavePolicy.create({
      data: { companyId: cid, name: `${MARKER} PTO`, kind: "PTO", annualDays: 20 },
    }));

  return {
    companyId: cid,
    managerUserId: manager.id,
    managerEmployeeId: managerEmployee.id,
    policyId: policy.id,
    staffEmployeeId: staffEmployee.id,
  };
}

async function addPendingItems(fx: Fixture) {
  const leave = await prisma.leaveRequest.create({
    data: {
      companyId: fx.companyId,
      employeeId: fx.staffEmployeeId,
      policyId: fx.policyId,
      startDate: new Date(Date.UTC(2026, 8, 1)),
      endDate: new Date(Date.UTC(2026, 8, 1)),
      days: 1,
      reason: MARKER,
      status: "PENDING",
    },
  });
  const report = await prisma.expenseReport.create({
    data: {
      companyId: fx.companyId,
      employeeId: fx.staffEmployeeId,
      title: `${MARKER} taxi`,
      periodStart: new Date(Date.UTC(2026, 8, 1)),
      periodEnd: new Date(Date.UTC(2026, 8, 30)),
      totalAmountCents: 4200,
      currency: "USD",
      status: "SUBMITTED",
    },
  });
  return { leave, report };
}

const saved = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
  secure: process.env.SMTP_SECURE,
};
function pointSmtpAt(port: number) {
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(port);
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_SECURE;
  process.env.SMTP_FROM = "digest-harness@localhost";
}
function restoreSmtp() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function main() {
  const { runApprovalDigest, collectDigestPlans } = await import(
    "./src/lib/approval-digest"
  );
  const { resetMailerForTests } = await import("./src/lib/mail");

  const fx = await setup();
  let sink: Sink | null = null;

  try {
    // ---- with SMTP off: the digest must report disabled, not "sent" ----

    delete process.env.SMTP_HOST;
    resetMailerForTests();
    await addPendingItems(fx);

    const disabled = await runApprovalDigest({ companyId: fx.companyId });
    check(
      "an unconfigured deployment reports disabled",
      disabled.disabled === true && disabled.sent === 0,
      JSON.stringify(disabled),
    );
    const leaked = await prisma.notification.count({
      where: { link: { startsWith: "digest:" } },
    });
    check("an unconfigured run writes no ledger rows", leaked === 0, `rows=${leaked}`);

    // ---- the plan matches the inbox ----

    const plans = await collectDigestPlans({ companyId: fx.companyId });
    const plan = plans.find((p) => p.reviewerId === fx.managerUserId);
    check("the manager gets a plan", plan !== undefined, JSON.stringify(plans.map((p) => p.reviewerId)));
    check("the plan carries both pending items", plan?.items.length === 2, String(plan?.items.length));
    check(
      "the plan holds one leave and one expense",
      plan?.items.filter((i) => i.kind === "leave").length === 1 &&
        plan.items.filter((i) => i.kind === "expense").length === 1,
    );

    // The seeded admin is a reviewer too, and canActAsAdmin() gives an admin the
    // whole company, so the admin's inbox really does show the same two items.
    // Emailing both is the consistent behaviour; this asserts it is intended
    // rather than accidental.
    const adminPlan = plans.find((p) => p.reviewerId !== fx.managerUserId);
    check("the admin also gets a plan for the same items", adminPlan?.items.length === 2, String(adminPlan?.items.length));
    check(
      "the admin and the manager are told about the same request ids",
      JSON.stringify(plan?.items.map((i) => i.id).sort()) ===
        JSON.stringify(adminPlan?.items.map((i) => i.id).sort()),
    );
    check(
      "an EMPLOYEE is never given a plan",
      !plans.some((p) => p.reviewerEmail === STAFF_EMAIL),
    );

    // ---- first run against a real SMTP sink ----

    sink = await startSink();
    pointSmtpAt(sink.port);
    resetMailerForTests();

    const first = await runApprovalDigest({ companyId: fx.companyId });
    check("the first run sends one digest per reviewer", first.sent === 2 && first.failed === 0, JSON.stringify(first));
    check(
      "the first run claims every item for every reviewer",
      first.skippedAlreadyNotified === 0,
      JSON.stringify(first),
    );
    check(
      "two messages reached the sink, one per reviewer",
      sink.messages.length === 2,
      `messages=${sink.messages.length}`,
    );
    const recipients = sink.messages.flatMap((m) => m.to).sort();
    // `User.email` is globally unique, so no companyId is needed here.
    const adminEmail =
      process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    check(
      "each reviewer was emailed exactly once",
      recipients.length === 2 && new Set(recipients).size === 2,
      recipients.join(","),
    );
    check(
      "the manager is among the recipients",
      recipients.includes(MANAGER_EMAIL),
      recipients.join(","),
    );
    const body = sink.messages[0]?.data ?? "";
    check("the delivered body names the requester", body.includes("Digest Staff"));
    check("the delivered body lists the expense", body.includes("taxi"));
    check("the delivered body has no unresolved placeholder", !/\{[a-zA-Z]+\}/.test(body), (body.match(/\{[a-zA-Z]+\}/) ?? [""])[0]);

    const rows = await prisma.notification.findMany({
      where: { link: { startsWith: "digest:" } },
      orderBy: { link: "asc" },
    });
    check(
      "one ledger row per (recipient, item)",
      rows.length === 4,
      `rows=${rows.length}`,
    );
    check(
      "the ledger links are the natural keys",
      rows.every((r) => /^digest:(leave|expense):/.test(r.link ?? "")),
      rows.map((r) => r.link).join(","),
    );
    check(
      "the ledger holds a row for the manager and one for the admin",
      rows.some((r) => r.userId === fx.managerUserId) &&
        (adminUser ? rows.some((r) => r.userId === adminUser.id) : false),
      rows.map((r) => r.userId).join(","),
    );
    check("the ledger records the request type", rows.some((r) => r.type === "LEAVE_REQUEST") && rows.some((r) => r.type === "EXPENSE_REQUEST"));

    // ---- second run: the idempotency the unique index buys ----

    const before = sink.messages.length;
    const second = await runApprovalDigest({ companyId: fx.companyId });
    check("a second run sends nothing", second.sent === 0, JSON.stringify(second));
    check(
      "a second run reports every (recipient, item) as already notified",
      second.skippedAlreadyNotified === 4,
      JSON.stringify(second),
    );
    check("no second message reached the sink", sink.messages.length === before);

    // ---- a newly arrived request is still picked up ----

    const extra = await prisma.leaveRequest.create({
      data: {
        companyId: fx.companyId,
        employeeId: fx.staffEmployeeId,
        policyId: fx.policyId,
        startDate: new Date(Date.UTC(2026, 8, 10)),
        endDate: new Date(Date.UTC(2026, 8, 10)),
        days: 1,
        reason: MARKER,
        status: "PENDING",
      },
    });
    const third = await runApprovalDigest({ companyId: fx.companyId });
    check("a new request is digested on the next run", third.sent === 2, JSON.stringify(third));
    check(
      "the new request is claimed while the old ones are skipped",
      third.skippedAlreadyNotified === 4,
      JSON.stringify(third),
    );
    check("the new request is not double-claimed for anyone", (await prisma.notification.count({ where: { link: `digest:leave:${extra.id}` } })) === 2);

    // ---- a failed send releases its claim so the next run retries ----

    await sink.close();
    sink = null;
    resetMailerForTests();

    // The request whose claim must be released. Not `extra`: that one was
    // notified successfully by the run above, so its claim is *supposed* to
    // still be there.
    const doomed = await prisma.leaveRequest.create({
      data: {
        companyId: fx.companyId,
        employeeId: fx.staffEmployeeId,
        policyId: fx.policyId,
        startDate: new Date(Date.UTC(2026, 8, 20)),
        endDate: new Date(Date.UTC(2026, 8, 20)),
        days: 1,
        reason: MARKER,
        status: "PENDING",
      },
    });

    const survivorsBefore = await prisma.notification.count({
      where: { link: `digest:leave:${extra.id}` },
    });
    const dead = await runApprovalDigest({ companyId: fx.companyId });
    check("an unreachable sink is counted as failed per reviewer", dead.failed === 2, JSON.stringify(dead));
    const claimedRow = await prisma.notification.findFirst({
      where: { link: `digest:leave:${doomed.id}` },
    });
    check(
      "a failed run leaves no claim behind for the failed item",
      claimedRow === null,
      claimedRow ? `link=${claimedRow.link}` : "",
    );
    const survivorsAfter = await prisma.notification.count({
      where: { link: `digest:leave:${extra.id}` },
    });
    check(
      "a failed run does not revoke the claims that were delivered successfully",
      survivorsBefore === 2 && survivorsAfter === 2,
      `before=${survivorsBefore} after=${survivorsAfter}`,
    );

    // Retry against a working sink: the previously-failed items must go out.
    const retrySink = await startSink();
    pointSmtpAt(retrySink.port);
    resetMailerForTests();
    const retry = await runApprovalDigest({ companyId: fx.companyId });
    check("the retried run succeeds", retry.sent === 2 && retry.failed === 0, JSON.stringify(retry));
    check("the retry delivers one message per reviewer", retrySink.messages.length === 2, `messages=${retrySink.messages.length}`);
    await retrySink.close();

    // ---- a decided request leaves the inbox entirely ----

    // All three leave requests were created with `reason: MARKER`, so the sweep
    // is unambiguous. The expense report is settled separately: the admin's
    // inbox is the whole company, so leaving it SUBMITTED would keep his plan
    // alive and hide the fact that the leave sweep worked.
    await prisma.leaveRequest.updateMany({
      where: { companyId: fx.companyId, reason: MARKER },
      data: { status: "APPROVED" },
    });
    await prisma.expenseReport.updateMany({
      where: { companyId: fx.companyId, title: { contains: MARKER } },
      data: { status: "APPROVED" },
    });
    const afterDecision = await collectDigestPlans({ companyId: fx.companyId });
    check(
      "deciding every request empties the plan",
      afterDecision.length === 0,
      JSON.stringify(afterDecision.map((p) => `${p.reviewerEmail}:${p.items.length}`)),
    );

    // ---- a settled request is not re-digested even though its claim exists ----

    const settled = await runApprovalDigest({ companyId: fx.companyId });
    check("a settled queue sends nothing", settled.sent === 0 && settled.planned === 0, JSON.stringify(settled));
  } finally {
    if (sink) await sink.close();
    restoreSmtp();
    await cleanup(fx.companyId);
  }

  const leftovers = await prisma.notification.count({ where: { link: { startsWith: "digest:" } } });
  check("cleanup removed every ledger row", leftovers === 0, `rows=${leftovers}`);

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.label}${r.detail ? "  " + r.detail : ""}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
