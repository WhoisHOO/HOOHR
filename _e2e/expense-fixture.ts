// Fixture user for _e2e/expenses.mjs.
//
// The expense flow cannot be exercised end to end by a single account, and the
// reason is a deliberate rule rather than an inconvenience:
//
//   * team.ts forbids self-review. canReviewEmployee() returns false when
//     target.employeeId === reviewer.employeeId, and approvalInboxEmployeeWhere()
//     excludes the reviewer's own employee from the inbox.
//   * inviteEmployee() only accepts ["EMPLOYEE", "MANAGER"], so the UI cannot
//     create a second admin, and paying requires canActAsAdmin().
//
// So the report is owned by a MANAGER and reviewed by the seeded admin. That
// combination needs no mutation of the admin's own employee record, and it
// still reaches every transition: DRAFT -> SUBMITTED -> REJECTED and
// DRAFT -> SUBMITTED -> APPROVED -> PAID.
//
// Creating the account in the database is test scaffolding; everything the
// suite asserts runs through the browser against the real forms.
//
//   npx tsx _e2e/expense-fixture.ts setup
//   npx tsx _e2e/expense-fixture.ts cleanup

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

export const MARKER = "E2E-EXPENSE-HARNESS";
export const MANAGER_EMAIL =
  process.env.E2E_MANAGER_EMAIL || "e2e-manager@example.com";
export const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "E2eManager1234!";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function companyId(): Promise<string> {
  const email = process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) throw new Error(`no seeded admin ${email}`);
  return admin.companyId;
}

async function removeAll(cid: string): Promise<{ reports: number; user: number }> {
  // ExpenseItem and ReceiptFile cascade from ExpenseReport, which cascades from
  // Employee, so deleting the employee already takes this manager's reports with
  // it. The explicit report sweep additionally covers reports left on the
  // seeded admin by an earlier interrupted run.
  await prisma.expenseReport.deleteMany({
    where: { companyId: cid, title: { contains: MARKER } },
  });
  // Employee.user is an optional relation with no onDelete rule, so deleting
  // the User leaves the Employee behind as an orphan. Employee is unique on
  // (companyId, email), so that orphan would make the next setup fail with
  // P2002. Delete the employee first, then the user.
  await prisma.employee.deleteMany({ where: { companyId: cid, email: MANAGER_EMAIL } });
  const users = await prisma.user.deleteMany({ where: { email: MANAGER_EMAIL } });
  const reports = await prisma.expenseReport.count({
    where: { companyId: cid, title: { contains: MARKER } },
  });
  return { reports, user: users.count };
}

async function setup() {
  const cid = await companyId();
  const swept = await removeAll(cid);

  const passwordHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      companyId: cid,
      email: MANAGER_EMAIL,
      name: "E2E Manager",
      passwordHash,
      role: "MANAGER",
      isActive: true,
    },
  });
  // ACTIVE, not INVITED: canManageEmployees() and canReviewEmployee() both
  // require an active employee record, and inviteEmployee is not available here.
  await prisma.employee.create({
    data: {
      companyId: cid,
      userId: user.id,
      name: "E2E Manager",
      email: MANAGER_EMAIL,
      status: "ACTIVE",
    },
  });

  console.log(
    `fixture: swept ${swept.reports} report(s) and ${swept.user} manager(s), ` +
      `created MANAGER ${MANAGER_EMAIL}`,
  );
}

async function cleanup() {
  const cid = await companyId();
  const { reports, user } = await removeAll(cid);
  console.log(
    `cleanup: ${reports} expense report(s) with title ${MARKER}, ` +
      `${user} manager user(s) ${MANAGER_EMAIL}`,
  );
}

const mode = process.argv[2] || "setup";
const run = mode === "cleanup" ? cleanup : setup;
run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
