import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, EmployeeStatus, LeaveTypeKind } from "../src/generated/prisma/client";
import {
  COUNTRY_DEFAULTS,
  DEFAULT_COUNTRY,
  isCountry,
  type CountryCode,
} from "../src/lib/country";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * 설치할 때 고른 국가 하나가 통화·시간대·언어를 모두 정한다. 그래서 시드 데이터
 * (부서명, 휴가 정책명, 경비 분류명)도 그 나라 말로 들어간다 - 미국 회사에
 * "교통/식비/병가"가 떠 있으면 첫인상이 무너지니까.
 *
 * 연차 일수는 국가를 보고 *추론하지 않는다*. 법적 entitlement를 지역 프리셋으로
 * 지어내는 것이 사용자가 명시적으로 거부한 설계다. 여기 넣는 숫자는 시작값일
 * 뿐이고 Settings 에서 고친다.
 */
const SEED_TEXT: Record<
  string,
  {
    companyName: string;
    adminName: string;
    adminPosition: string;
    departments: string[];
    policies: { name: string; kind: LeaveTypeKind; annualDays: number; maxCarryOverDays: number; isPaid: boolean }[];
    categories: string[];
  }
> = {
  ko: {
    companyName: "내 회사",
    adminName: "관리자",
    adminPosition: "대표",
    departments: ["관리", "개발", "영업", "디자인"],
    policies: [
      { name: "연차", kind: LeaveTypeKind.PTO, annualDays: 10, maxCarryOverDays: 5, isPaid: true },
      { name: "병가", kind: LeaveTypeKind.SICK, annualDays: 5, maxCarryOverDays: 0, isPaid: true },
      { name: "무급휴직", kind: LeaveTypeKind.UNPAID, annualDays: 0, maxCarryOverDays: 0, isPaid: false },
    ],
    categories: ["교통", "식비", "숙박", "회의비", "교육비", "기타"],
  },
  en: {
    companyName: "My Company",
    adminName: "Admin",
    adminPosition: "CEO",
    departments: ["Admin", "Engineering", "Sales", "Design"],
    policies: [
      { name: "PTO", kind: LeaveTypeKind.PTO, annualDays: 10, maxCarryOverDays: 5, isPaid: true },
      { name: "Sick day", kind: LeaveTypeKind.SICK, annualDays: 5, maxCarryOverDays: 0, isPaid: true },
      { name: "Unpaid leave", kind: LeaveTypeKind.UNPAID, annualDays: 0, maxCarryOverDays: 0, isPaid: false },
    ],
    categories: ["Transport", "Meals", "Lodging", "Meetings", "Education", "Other"],
  },
};

async function main() {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const rawCountry = process.env.COMPANY_COUNTRY;
  const country: CountryCode = isCountry(rawCountry) ? rawCountry : DEFAULT_COUNTRY;
  const { currency, timezone, locale } = COUNTRY_DEFAULTS[country];
  const text = SEED_TEXT[locale];
  const companyName = process.env.BOOTSTRAP_COMPANY_NAME || text.companyName;

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

  // 1. Company. Country is the one answer the user gave at install time;
  // currency and timezone come from it rather than being asked separately.
  const company = await prisma.company.create({
    data: { name: companyName, country, currency, timezone },
  });

  // 2. Departments
  const departments: { id: string; name: string }[] = [];
  for (const name of text.departments) {
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
      name: text.adminName,
      passwordHash,
      role: Role.ADMIN,
    },
  });
  const adminEmployee = await prisma.employee.create({
    data: {
      companyId: company.id,
      userId: adminUser.id,
      departmentId: departments[0].id,
      name: text.adminName,
      email: adminEmail,
      position: text.adminPosition,
      hireDate: new Date(`${year}-01-01`),
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 4. Leave policies. The day counts are starting values the admin edits in
  // Settings - not a legal entitlement for the country.
  for (const policy of text.policies) {
    await prisma.leavePolicy.create({
      data: {
        companyId: company.id,
        name: policy.name,
        kind: policy.kind,
        annualDays: policy.annualDays,
        maxCarryOverDays: policy.maxCarryOverDays,
        isPaid: policy.isPaid,
      },
    });
  }

  // 5. Leave balances for admin this year
  const yearPolicies = await prisma.leavePolicy.findMany({
    where: { companyId: company.id, kind: { in: [LeaveTypeKind.PTO, LeaveTypeKind.SICK] } },
    select: { id: true, annualDays: true },
  });
  for (const policy of yearPolicies) {
    await prisma.leaveBalance.create({
      data: {
        employeeId: adminEmployee.id,
        policyId: policy.id,
        year,
        grantedDays: policy.annualDays,
      },
    });
  }

  // 6. Expense categories - a receipt needs a category before it can be filed.
  for (const name of text.categories) {
    await prisma.expenseCategory.create({
      data: { companyId: company.id, name },
    });
  }

  // No holidays are seeded. A holiday calendar is the company's own data, and
  // guessing one from a country is exactly the region preset this product does
  // not do. The admin adds the ones that apply in Settings.

  console.log(`
=====================================
부트스트랩 완료
- 국가: ${country} (${currency} / ${timezone} / ${locale})
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
