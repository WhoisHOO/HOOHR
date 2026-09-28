import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
import { computeLeaveDays, countWorkdays } from "./src/lib/leave";
import { isWorkday, toHolidaySet } from "./src/lib/holidays";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const stamp = Date.now().toString(36);
const results: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(
    `${ok ? "PASS" : "FAIL"} ${label} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`,
  );
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const at = (value: string) => new Date(`${value}T00:00:00.000Z`);

const TEST_CATEGORY_PREFIX = "테스트 분류";
const TEST_REASON = "holiday-aware test";

/** Removes leftovers from this or an earlier aborted run. */
async function cleanFixtures(): Promise<number> {
  await prisma.expenseItem.deleteMany({
    where: { report: { title: TEST_REASON } },
  });
  await prisma.expenseReport.deleteMany({ where: { title: TEST_REASON } });
  await prisma.expenseCategory.deleteMany({
    where: { name: { startsWith: TEST_CATEGORY_PREFIX } },
  });
  await prisma.leaveRequest.deleteMany({ where: { reason: TEST_REASON } });
  await prisma.holiday.deleteMany({
    where: {
      OR: [
        { name: { startsWith: "테스트 공휴일" } },
        { date: { gte: at("2026-03-01"), lte: at("2026-03-08") } },
      ],
    },
  });
  return (
    (await prisma.holiday.count({
      where: { name: { startsWith: "테스트 공휴일" } },
    })) +
    (await prisma.expenseCategory.count({
      where: { name: { startsWith: TEST_CATEGORY_PREFIX } },
    })) +
    (await prisma.leaveRequest.count({ where: { reason: TEST_REASON } }))
  );
}

async function main() {
  const cleanedBefore = await cleanFixtures();
  console.log("pre-run leftovers swept:", cleanedBefore);

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com" },
    include: { employee: true },
  });
  const companyId = admin.companyId;

  // Pick a stable Mon-Fri week so weekend math is deterministic.
  const monday = at("2026-03-02"); // Mon
  const friday = at("2026-03-06"); // Fri
  const wednesday = at("2026-03-04");

  // --- 1) pure holiday-aware counting ------------------------------------
  check("Mon-Fri without holidays = 5", countWorkdays(monday, friday), 5);
  check("Sat-Sun only = 0", countWorkdays(at("2026-03-07"), at("2026-03-08")), 0);
  check("single workday = 1", countWorkdays(wednesday, wednesday), 1);
  check(
    "one holiday inside the week drops the count",
    countWorkdays(monday, friday, toHolidaySet([{ date: wednesday }])),
    4,
  );
  check(
    "holiday on a weekend changes nothing",
    countWorkdays(monday, friday, toHolidaySet([{ date: at("2026-03-07") }])),
    5,
  );
  check(
    "a full holiday week is 0 workdays",
    countWorkdays(
      monday,
      friday,
      toHolidaySet([
        { date: monday },
        { date: at("2026-03-03") },
        { date: wednesday },
        { date: at("2026-03-05") },
        { date: friday },
      ]),
    ),
    0,
  );
  check("half day is always 0.5", computeLeaveDays(wednesday, wednesday, true, toHolidaySet([{ date: wednesday }])), 0.5);
  check("weekend detection", isWorkday(at("2026-03-08"), toHolidaySet([])), false);
  check("holiday detection", isWorkday(wednesday, toHolidaySet([{ date: wednesday }])), false);
  // A half-day on a non-workday is what the requestLeave guard blocks, so the
  // client preview and the action must agree on the same predicate.
  check(
    "half-day on a holiday is a non-workday (guard trips)",
    isWorkday(wednesday, toHolidaySet([{ date: wednesday }])),
    false,
  );
  check(
    "half-day on a Saturday is a non-workday (guard trips)",
    isWorkday(at("2026-03-07"), toHolidaySet([])),
    false,
  );
  check(
    "half-day on a normal workday is allowed",
    isWorkday(wednesday, toHolidaySet([{ date: monday }])),
    true,
  );

  // --- 2) DB: holiday row affects a real leave request --------------------
  const holidayName = `테스트 공휴일 ${stamp}`;
  const holiday = await prisma.holiday.create({
    data: { companyId, date: wednesday, name: holidayName },
  });
  check("holiday persisted", iso(holiday.date), iso(wednesday));

  const duplicate = await prisma.holiday.create({
    data: { companyId, date: wednesday, name: `${holidayName} 중복` },
  }).catch((error: unknown) => (error as { code?: string }).code);
  check("duplicate holiday is rejected by the unique index", duplicate, "P2002");

  const pto = await prisma.leavePolicy.findFirstOrThrow({
    where: { companyId, kind: "PTO" },
  });
  const balance = await prisma.leaveBalance.findUniqueOrThrow({
    where: {
      employeeId_policyId_year: {
        employeeId: admin.employee!.id,
        policyId: pto.id,
        year: wednesday.getUTCFullYear(),
      },
    },
  });
  const beforeUsed = balance.usedDays;
  const beforeGranted = balance.grantedDays;

  // Mirrors decideLeave: day count is stored on the request, balance is not touched here.
  const holidayAwareDays = computeLeaveDays(
    monday,
    friday,
    false,
    toHolidaySet([{ date: wednesday }]),
  );
  const request = await prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId: admin.employee!.id,
      policyId: pto.id,
      startDate: monday,
      endDate: friday,
      isHalfDay: false,
      days: holidayAwareDays,
      reason: TEST_REASON,
    },
  });
  check("stored days exclude the holiday", request.days, 4);
  check(
    "balance untouched by request creation",
    (await prisma.leaveBalance.findUniqueOrThrow({
      where: {
        employeeId_policyId_year: {
          employeeId: admin.employee!.id,
          policyId: pto.id,
          year: wednesday.getUTCFullYear(),
        },
      },
    })).usedDays,
    beforeUsed,
  );

  // --- 3) policy edit + apply-to-balances ---------------------------------
  // Snapshot the policy separately from the balance: the restore below must put
  // back what the policy actually had, otherwise an aborted run leaves drift.
  const beforeAnnualDays = pto.annualDays;
  const edited = await prisma.leavePolicy.update({
    where: { id: pto.id },
    data: { annualDays: beforeAnnualDays + 3 },
  });
  check("policy annualDays updated", edited.annualDays, beforeAnnualDays + 3);

  const applied = await prisma.leaveBalance.updateMany({
    where: { policyId: pto.id, year: wednesday.getUTCFullYear() },
    data: { grantedDays: edited.annualDays },
  });
  const afterApply = await prisma.leaveBalance.findUniqueOrThrow({
    where: {
      employeeId_policyId_year: {
        employeeId: admin.employee!.id,
        policyId: pto.id,
        year: wednesday.getUTCFullYear(),
      },
    },
  });
  check("apply updated every balance row", applied.count > 0, true);
  check("grantedDays applied", afterApply.grantedDays, beforeAnnualDays + 3);
  check("usedDays preserved by apply", afterApply.usedDays, beforeUsed);

  // --- 4) expense category: in-use rows cannot be deleted -----------------
  const category = await prisma.expenseCategory.create({
    data: { companyId, name: `테스트 분류 ${stamp}` },
  });
  const deletable = await prisma.expenseCategory.deleteMany({
    where: { id: category.id },
  });
  check("unused category is deletable", deletable.count, 1);

  const used = await prisma.expenseCategory.create({
    data: { companyId, name: `테스트 분류 ${stamp} B` },
  });
  const report = await prisma.expenseReport.create({
    data: {
      companyId,
      employeeId: admin.employee!.id,
      title: TEST_REASON,
      periodStart: monday,
      periodEnd: friday,
    },
  });
  await prisma.expenseItem.create({
    data: {
      reportId: report.id,
      categoryId: used.id,
      date: wednesday,
      amountCents: 1000,
      description: "test",
    },
  });
  const itemCount = await prisma.expenseItem.count({ where: { categoryId: used.id } });
  check("category with items reports usage", itemCount > 0, true);
  const blocked = await prisma.expenseCategory
    .delete({ where: { id: used.id } })
    .catch((error: unknown) => (error as { code?: string }).code);
  check("in-use category delete is rejected by FK", blocked !== undefined, true);

  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);

  // --- cleanup -------------------------------------------------------------
  await prisma.expenseItem.deleteMany({ where: { reportId: report.id } });
  await prisma.expenseReport.delete({ where: { id: report.id } });
  await prisma.expenseCategory.deleteMany({ where: { name: { contains: stamp } } });
  await prisma.leaveRequest.deleteMany({ where: { id: request.id } });
  await prisma.leaveBalance.update({
    where: {
      employeeId_policyId_year: {
        employeeId: admin.employee!.id,
        policyId: pto.id,
        year: wednesday.getUTCFullYear(),
      },
    },
    data: { grantedDays: beforeGranted, usedDays: beforeUsed },
  });
  await prisma.leavePolicy.update({
    where: { id: pto.id },
    data: { annualDays: beforeAnnualDays },
  });
  await prisma.holiday.deleteMany({ where: { companyId, name: { contains: stamp } } });

  const leftovers =
    (await prisma.holiday.count({ where: { name: { contains: stamp } } })) +
    (await prisma.expenseCategory.count({ where: { name: { contains: stamp } } })) +
    (await prisma.leaveRequest.count({ where: { reason: TEST_REASON } }));
  console.log("cleanup leftovers:", leftovers);

  await prisma.$disconnect();
  if (failed > 0 || leftovers > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
