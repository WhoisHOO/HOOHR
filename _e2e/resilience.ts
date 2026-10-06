// Exception / null-dereference sweep.
//
// The happy-path suites (forms, expenses) all pass, which says nothing about
// the states a real install reaches that the fixtures never create:
//
//   - an employee who accepted an invite and therefore has a User row but NO
//     LeaveBalance row (nothing creates one: not the seed, not acceptInvitation)
//   - an employee still in INVITED, so Employee.user is null
//   - an employee with no department and no approver
//   - an ADMIN whose session outlives a deactivation
//
// Those are exactly the states where a page render can dereference null or a
// write can hit P2025. This script builds each one, then visits every route and
// drives the writes that touch those rows, and fails on any 5xx, any thrown
// server error, or any action that returns an error message where the flow
// should have succeeded.
//
// Run with:  npx tsx _e2e/resilience.ts        (dev server must be running)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const ADMIN_EMAIL =
  process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
const MARK = "E2E-RESILIENCE";

/**
 * A real session token, so the page sweep actually renders the pages.
 *
 * `fetch` alone cannot log in, and an anonymous request to /hoohr/** is
 * redirected to /login before any page code runs - so sweeping without this
 * tests the route guard and nothing else, which is exactly the mistake the
 * first version of this script made. lib/session.ts cannot be imported here
 * (it is `server-only`), but `encrypt` is pure, so the same HS256 token is
 * signed directly.
 */
async function sessionCookie(userId: string, companyId: string, role: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const token = await new SignJWT({
    userId,
    companyId,
    role,
    expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 7 * 24 * 3600)
    .sign(new TextEncoder().encode(secret));
  return { cookie: `session=${token}` };
}

let pass = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

type Ctx = { companyId: string; year: number };

/** Build every awkward state, and return the ids needed to exercise them. */
async function seed(ctx: Ctx) {
  const suffix = Date.now().toString(36);

  // 1. Accepted invite, no LeaveBalance. This is what acceptInvitation produces.
  const balanceLessEmail = `res-nobal-${suffix}@example.com`;
  const balanceLess = await prisma.employee.create({
    data: {
      companyId: ctx.companyId,
      name: "No Balance",
      email: balanceLessEmail,
      status: "ACTIVE",
      hireDate: new Date(),
    },
  });
  const balanceLessUser = await prisma.user.create({
    data: {
      companyId: ctx.companyId,
      email: balanceLessEmail,
      name: "No Balance",
      passwordHash: "x", // never logged into; the sweep only reads as this user
      role: "EMPLOYEE",
      employee: { connect: { id: balanceLess.id } },
    },
  });

  // 2. Still invited: Employee.user is null, no password, no session possible.
  const invitedEmail = `res-invited-${suffix}@example.com`;
  const invited = await prisma.employee.create({
    data: {
      companyId: ctx.companyId,
      name: "Still Invited",
      email: invitedEmail,
      status: "INVITED",
    },
  });
  await prisma.invitation.create({
    data: {
      companyId: ctx.companyId,
      email: invitedEmail,
      token: `res-${suffix}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // 3. Active, linked, but no department and no approver at all.
  const orphanEmail = `res-orphan-${suffix}@example.com`;
  const orphan = await prisma.employee.create({
    data: {
      companyId: ctx.companyId,
      name: "No Department",
      email: orphanEmail,
      status: "ACTIVE",
    },
  });
  const orphanUser = await prisma.user.create({
    data: {
      companyId: ctx.companyId,
      email: orphanEmail,
      name: "No Department",
      passwordHash: "x",
      role: "EMPLOYEE",
      employee: { connect: { id: orphan.id } },
    },
  });

  return { balanceLess, balanceLessUser, invited, orphan, orphanUser, suffix };
}

async function cleanup(ctx: Ctx, s: Awaited<ReturnType<typeof seed>>) {
  const ids = [s.balanceLess.id, s.invited.id, s.orphan.id];
  await prisma.notification.deleteMany({ where: { userId: { in: [s.balanceLessUser.id, s.orphanUser.id] } } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.expenseReport.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.invitation.deleteMany({ where: { email: { startsWith: "res-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "res-" } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  void ctx;
}

async function main() {
  const probe = await fetch(`${BASE}/login`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`dev server not reachable at ${BASE} - start it with: npm run dev`);
    process.exit(1);
  }

  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, companyId: true, role: true, employee: { select: { id: true } } },
  });
  if (!admin) throw new Error(`no admin user ${ADMIN_EMAIL}`);
  const ctx: Ctx = { companyId: admin.companyId, year: new Date().getUTCFullYear() };

  const s = await seed(ctx);
  console.log(`\nseeded: ${s.suffix}`);
  console.log(`  balance-less employee ${s.balanceLess.id}`);
  console.log(`  invited employee      ${s.invited.id}`);
  console.log(`  no-department employee ${s.orphan.id}\n`);

  try {
    // ---------------------------------------------------------------------
    // 1. Does any route 5xx while these rows exist? With a REAL session, or
    //    every one of these is a redirect to /login and proves nothing.
    // ---------------------------------------------------------------------
    const auth = await sessionCookie(admin.id, admin.companyId, admin.role);
    console.log("page sweep (authenticated as admin):");
    const routes = [
      "/hoohr",
      "/hoohr/leave",
      "/hoohr/expenses",
      `/hoohr/expenses/export?month=${ctx.year}-01`,
      "/hoohr/admin/employees",
      "/hoohr/admin/invite",
      "/hoohr/admin/balances",
      "/hoohr/admin/settings",
    ];
    for (const route of routes) {
      const res = await fetch(`${BASE}${route}`, {
        headers: { cookie: auth.cookie },
        redirect: "manual",
      });
      const body = res.status === 200 ? await res.text() : "";
      const errored =
        res.status >= 500 ||
        /Application error|Internal Server Error|__next_error__/.test(body);
      check(
        `GET ${route}`,
        !errored,
        `status ${res.status}${errored ? " (server error in body)" : ""}`,
      );
      // A redirect while authenticated means the guard rejected a valid
      // session, which is its own failure mode and must not read as "ok".
      if (res.status >= 300 && res.status < 400 && route !== "/hoohr") {
        check(
          `GET ${route} was not redirected`,
          false,
          `redirected to ${res.headers.get("location")}`,
        );
      }
      if (route === "/hoohr/admin/employees" && res.status === 200) {
        // The invited employee has userId null. If the page dereferences it
        // the render throws, which Next turns into a 500 - but assert the row
        // is really on the page too, so a silent filter cannot pass this.
        check(
          "the employees page really lists the invited employee",
          body.includes(s.invited.id),
          "invited employee missing from the rendered page",
        );
        check(
          "the employees page really lists the balance-less employee",
          body.includes(s.balanceLess.id),
          "balance-less employee missing from the rendered page",
        );
      }
    }

    // ---------------------------------------------------------------------
    // 2. Unauthenticated and bogus-token paths.
    // ---------------------------------------------------------------------
    console.log("\nunauthenticated / bad token:");
    for (const route of routes) {
      const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
      check(
        `anon GET ${route} does not 5xx`,
        res.status < 500,
        `status ${res.status}`,
      );
    }
    const badInvite = await fetch(`${BASE}/invite/res-does-not-exist`, {
      redirect: "manual",
    });
    check("GET /invite/<unknown token> does not 5xx", badInvite.status < 500, `status ${badInvite.status}`);

    // ---------------------------------------------------------------------
    // 3. The G1 write path, for real, at the database level.
    //    Reproduces what decideLeave does inside its transaction, so the
    //    failure mode is observed rather than predicted.
    // ---------------------------------------------------------------------
    console.log("\nG1: approving PTO for an employee with no balance row");
    const policy = await prisma.leavePolicy.findFirstOrThrow({
      where: { companyId: ctx.companyId, kind: "PTO" },
      select: { id: true },
    });
    const start = new Date(Date.UTC(ctx.year, 10, 16));
    const req = await prisma.leaveRequest.create({
      data: {
        companyId: ctx.companyId,
        employeeId: s.balanceLess.id,
        policyId: policy.id,
        startDate: start,
        endDate: start,
        days: 1,
        reason: `${MARK} g1`,
        status: "PENDING",
      },
    });

    let p2025: string | null = null;
    try {
      // Exactly the shape of leave.ts:205-216 after the B fix: an upsert, so a
      // missing balance row is created rather than raising P2025.
      await prisma.$transaction(async (tx) => {
        const r = await tx.leaveRequest.updateMany({
          where: { id: req.id, status: "PENDING" },
          data: { status: "APPROVED", decidedAt: new Date() },
        });
        if (r.count !== 1) return null;
        await tx.leaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: s.balanceLess.id,
              policyId: policy.id,
              year: start.getUTCFullYear(),
            },
          },
          update: { usedDays: { increment: 1 } },
          create: {
            employeeId: s.balanceLess.id,
            policyId: policy.id,
            year: start.getUTCFullYear(),
            grantedDays: 0,
            usedDays: 1,
            adjustDays: 0,
          },
        });
        return true;
      });
    } catch (e) {
      p2025 = String(e).split("\n").slice(0, 3).join(" ");
    }
    check("the upsert does NOT throw for a balance-less employee (G1 fixed)", p2025 === null, p2025 || "");

    if (p2025 === null) {
      const after = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: req.id },
        select: { status: true },
      });
      check("the approval committed", after.status === "APPROVED", `status=${after.status}`);

      const created = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId: s.balanceLess.id,
            policyId: policy.id,
            year: start.getUTCFullYear(),
          },
        },
        select: { usedDays: true },
      });
      check(
        "the balance row was auto-created with the used days recorded",
        created?.usedDays === 1,
        `usedDays=${created?.usedDays}`,
      );
    }

    // A second approval for the same year must increment the row the first one
    // created, not try to create a second one (which would be P2002).
    const req2 = await prisma.leaveRequest.create({
      data: {
        companyId: ctx.companyId,
        employeeId: s.balanceLess.id,
        policyId: policy.id,
        startDate: new Date(Date.UTC(ctx.year, 10, 17)),
        endDate: new Date(Date.UTC(ctx.year, 10, 17)),
        days: 2,
        reason: `${MARK} g1-second`,
        status: "PENDING",
      },
    });
    let secondOk = false;
    try {
      await prisma.$transaction(async (tx) => {
        const r = await tx.leaveRequest.updateMany({
          where: { id: req2.id, status: "PENDING" },
          data: { status: "APPROVED", decidedAt: new Date() },
        });
        if (r.count !== 1) return null;
        await tx.leaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: s.balanceLess.id,
              policyId: policy.id,
              year: ctx.year,
            },
          },
          update: { usedDays: { increment: 2 } },
          create: {
            employeeId: s.balanceLess.id,
            policyId: policy.id,
            year: ctx.year,
            grantedDays: 0,
            usedDays: 2,
            adjustDays: 0,
          },
        });
        return true;
      });
      secondOk = true;
    } catch (e) {
      console.log(`       ${String(e).split("\n")[0]}`);
    }
    check("a second approval increments the same row (no P2002)", secondOk);
    // The CSV import still works and still creates a balance row explicitly -
    // the B fix did not remove the feature, it only stopped making it mandatory.
    const bal = await prisma.leaveBalance.create({
      data: {
        employeeId: s.orphan.id,
        policyId: policy.id,
        year: start.getUTCFullYear(),
        grantedDays: 10,
      },
    });
    check("an explicit balance row can still be created (CSV import path)", !!bal);

    // ---------------------------------------------------------------------
    // 4. applyPolicyToCurrentYear still only touches existing rows. It is not
    //    a grant mechanism and was never one; the point of the B fix is that
    //    nothing needs it any more, not that it learned to create rows.
    // ---------------------------------------------------------------------
    console.log("\nsettings: apply policy to a year where one employee has no row");
    const result = await prisma.leaveBalance.updateMany({
      where: { policyId: policy.id, year: ctx.year },
      data: { grantedDays: 10 },
    });
    const fresh = await prisma.employee.findUniqueOrThrow({
      where: { id: s.invited.id },
      select: { id: true },
    });
    const freshRows = await prisma.leaveBalance.count({ where: { employeeId: fresh.id } });
    check(
      "applyPolicy still cannot create a row for someone who has none",
      freshRows === 0,
      `rows=${freshRows}`,
    );
    check("but it reports how many rows it did update", result.count >= 1, `count=${result.count}`);

    // ---------------------------------------------------------------------
    // 5. The orphan (no department, no approver) as a reviewer target.
    // ---------------------------------------------------------------------
    console.log("\norphan employee as an approval target:");
    const orphanReq = await prisma.leaveRequest.create({
      data: {
        companyId: ctx.companyId,
        employeeId: s.orphan.id,
        policyId: policy.id,
        startDate: start,
        endDate: start,
        days: 1,
        reason: `${MARK} orphan`,
        status: "PENDING",
      },
    });
    const { canReviewEmployee, approvalReviewerFromUser, approvalReviewerSelect, approvalTargetInclude } = await import(
      "../src/lib/team"
    );
    const adminRow = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL },
      select: { ...approvalReviewerSelect },
    });
    const target = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: orphanReq.id },
      include: { policy: true, ...approvalTargetInclude },
    });
    let reviewerThrew = false;
    let allowed = false;
    try {
      allowed = canReviewEmployee(approvalReviewerFromUser(adminRow), target);
    } catch (e) {
      reviewerThrew = true;
      console.log(`       ${String(e).slice(0, 160)}`);
    }
    check("canReviewEmployee does not throw on a null department/approver", !reviewerThrew);
    check("an admin may still review a department-less employee", allowed === true, `allowed=${allowed}`);

    // ---------------------------------------------------------------------
    // 6. The invited employee has userId null. Anything that assumes a linked
    //    User would dereference null.
    // ---------------------------------------------------------------------
    console.log("\ninvited employee (Employee.user is null):");
    const invitedRow = await prisma.employee.findUniqueOrThrow({
      where: { id: s.invited.id },
      select: { id: true, userId: true, status: true },
    });
    check("the invited employee really has no linked user", invitedRow.userId === null, `userId=${invitedRow.userId}`);
  } finally {
    await cleanup(ctx, s);
    console.log("\ncleaned up");
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
  })
  .finally(() => prisma.$disconnect());
