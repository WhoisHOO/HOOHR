// Removes the fixtures created by _e2e/forms.mjs.
//
// The browser E2E has to create real records to have anything to verify, so
// it has to clean up after itself the same way the _test-*.ts scripts do.
// Leaving an attendance row or a pending leave request behind would quietly
// corrupt later runs, because the check-in button is then already disabled and
// the leave policy balance is already spent.
//
// Run directly with:  npx tsx _e2e/cleanup.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { zonedToday } from "../src/lib/attendance";

export const E2E_REASON_MARKER = "E2E-LOCALE-HARNESS";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const email = process.env.E2E_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const admin = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });
  if (!admin?.employee) throw new Error(`no employee for ${email}`);

  const company = await prisma.company.findUnique({ where: { id: admin.companyId } });
  const today = zonedToday(company?.timezone ?? "UTC");

  // Leave requests tagged with the marker reason. AttendanceEvent and
  // AttendanceCorrection cascade from AttendanceRecord, so deleting the
  // record is enough to clean the whole subtree.
  const leaves = await prisma.leaveRequest.deleteMany({
    where: { employeeId: admin.employee.id, reason: E2E_REASON_MARKER },
  });

  const attendance = await prisma.attendanceRecord.deleteMany({
    where: { employeeId: admin.employee.id, date: today },
  });

  console.log(
    `cleanup: ${leaves.count} leave request(s) with reason ${E2E_REASON_MARKER}, ` +
      `${attendance.count} attendance record(s) for ${today.toISOString().slice(0, 10)}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
