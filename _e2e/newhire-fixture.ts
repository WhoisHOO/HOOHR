// Fixture for _e2e/newhire.mjs: an employee in exactly the state
// acceptInvitation produces - a User row, an Employee row, and NO LeaveBalance.
//
// Seed mode prints the credentials the browser half needs; cleanup mode removes
// everything. Run directly with:  npx tsx _e2e/newhire-fixture.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PREFIX = "newhire-e2e-";

async function main() {
  if (process.env.NEWHIRE_INSPECT) {
    // Report what the leave page will now show, so the browser half can assert
    // on a real number instead of guessing at the format.
    const employee = await prisma.employee.findFirst({
      where: { email: { startsWith: PREFIX } },
      select: { id: true, leaveBalances: { select: { grantedDays: true, usedDays: true, adjustDays: true } } },
    });
    if (!employee) {
      console.log("NEWHIRE_USED=undefined");
      console.log("NEWHIRE_GRANTED=undefined");
      return;
    }
    const pto = employee.leaveBalances.find((b) => b.grantedDays !== 0 || b.usedDays !== 0);
    const granted = pto ? pto.grantedDays : 0;
    const used = pto ? pto.usedDays : 0;
    const adjust = pto ? pto.adjustDays : 0;
    console.log(`NEWHIRE_GRANTED=${granted}`);
    console.log(`NEWHIRE_USED=${used}`);
    console.log(`NEWHIRE_REMAINING=${granted - used + adjust}`);
    console.log(`NEWHIRE_ROWS=${employee.leaveBalances.length}`);
    return;
  }

  if (process.env.NEWHIRE_CLEANUP) {
    const employees = await prisma.employee.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = employees.map((e) => e.id);
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.expenseReport.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.invitation.deleteMany({ where: { email: { startsWith: PREFIX } } });
    const users = await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    const deleted = await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    console.log(`removed ${deleted.count} employee(s) and ${users.count} user(s)`);
    return;
  }

  const adminEmail =
    process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
    select: { companyId: true },
  });
  const password = process.env.RESILIENCE_PASSWORD;
  if (!password) throw new Error("RESILIENCE_PASSWORD is required");

  // Clear anything a previous interrupted run left behind.
  await main_cleanup();

  const email = `${PREFIX}${Date.now().toString(36)}@example.com`;
  const employee = await prisma.employee.create({
    data: {
      companyId: admin.companyId,
      name: "New Hire",
      email,
      status: "ACTIVE",
      hireDate: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      companyId: admin.companyId,
      email,
      name: "New Hire",
      passwordHash: await bcrypt.hash(password, 10),
      role: "EMPLOYEE",
      employee: { connect: { id: employee.id } },
    },
  });

  const balances = await prisma.leaveBalance.count({ where: { employeeId: employee.id } });
  if (balances !== 0) {
    throw new Error(`fixture is wrong: ${balances} balance row(s) exist, expected 0`);
  }

  console.log(`NEWHIRE_EMAIL=${email}`);
  console.log(`NEWHIRE_TOKEN=${employee.id}`);
  console.log(`NEWHIRE_BALANCES=${balances}`);
}

async function main_cleanup() {
  const employees = await prisma.employee.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = employees.map((e) => e.id);
  if (ids.length === 0) return;
  await prisma.notification.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.expenseReport.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.invitation.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
