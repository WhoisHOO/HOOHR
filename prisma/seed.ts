import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, EmployeeStatus, LeaveTypeKind } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const companyName = process.env.BOOTSTRAP_COMPANY_NAME || "내 회사";

  // Refuse to fall back to a well-known password. A default here would be
  // printed in this repo, so a fresh install whose .env was not written
  // correctly would silently come up with a publicly known admin credential.
  // `start.bat` generates a random one and shows it to the user instead.
  if (!adminPassword) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD is not set. Put a password in .env " +
        "(start.bat generates one for you) and run the seed again.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(
      `Seed already applied - the account ${adminEmail} exists, so nothing was changed.`,
    );
    return;
  }

  const year = new Date().getFullYear();

  // 2. Company (EST 동부 표준시)
  const company = await prisma.company.create({
    data: { name: companyName, timezone: "America/New_York" },
  });

  // 2. Departments
  const deptNames = ["관리", "개발", "영업", "디자인"];
  const departments: { id: string; name: string }[] = [];
  for (const name of deptNames) {
    const d = await prisma.department.create({
      data: { companyId: company.id, name },
    });
    departments.push(d);
  }

  // 3. Admin user + employee record
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      email: adminEmail,
      name: "관리자",
      passwordHash,
      role: Role.ADMIN,
    },
  });
  const adminEmployee = await prisma.employee.create({
    data: {
      companyId: company.id,
      userId: adminUser.id,
      departmentId: departments[0].id,
      name: "관리자",
      email: adminEmail,
      position: "대표",
      hireDate: new Date(`${year}-01-01`),
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 4. Leave policies (연차 10일/병가 5일 — 사용자 결정 2026-09-24)
  const pto = await prisma.leavePolicy.create({
    data: {
      companyId: company.id,
      name: "연차",
      kind: LeaveTypeKind.PTO,
      annualDays: 10,
      maxCarryOverDays: 5,
    },
  });
  const sick = await prisma.leavePolicy.create({
    data: {
      companyId: company.id,
      name: "병가",
      kind: LeaveTypeKind.SICK,
      annualDays: 5,
      maxCarryOverDays: 0,
    },
  });
  await prisma.leavePolicy.create({
    data: {
      companyId: company.id,
      name: "무급휴직",
      kind: LeaveTypeKind.UNPAID,
      annualDays: 0,
      isPaid: false,
    },
  });

  // 5. Leave balances for admin this year
  for (const policy of [pto, sick]) {
    await prisma.leaveBalance.create({
      data: {
        employeeId: adminEmployee.id,
        policyId: policy.id,
        year,
        grantedDays: policy.annualDays,
      },
    });
  }

  // 6. Expense categories
  const categories = ["교통", "식비", "숙박", "회의비", "교육비", "기타"];
  for (const name of categories) {
    await prisma.expenseCategory.create({
      data: { companyId: company.id, name },
    });
  }

  // 7. 2026 미국 연방 공휴일
  const holidays: [string, string][] = [
    ["2026-01-01", "New Year's Day"],
    ["2026-01-19", "Martin Luther King Jr. Day"],
    ["2026-02-16", "Washington's Birthday"],
    ["2026-05-25", "Memorial Day"],
    ["2026-06-19", "Juneteenth"],
    ["2026-07-03", "Independence Day (observed)"],
    ["2026-09-07", "Labor Day"],
    ["2026-10-12", "Columbus Day"],
    ["2026-11-11", "Veterans Day"],
    ["2026-11-26", "Thanksgiving"],
    ["2026-12-25", "Christmas Day"],
  ];
  for (const [date, name] of holidays) {
    await prisma.holiday.create({
      data: { companyId: company.id, date: new Date(date), name },
    });
  }
  console.log(`
=====================================
부트스트랩 완료
- 회사: ${companyName}
- 관리자 로그인: ${adminEmail} / ${adminPassword}
=====================================`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });