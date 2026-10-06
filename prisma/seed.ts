import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  EmployeeStatus,
  LeaveTypeKind,
} from "../src/generated/prisma/client";
import {
  DEFAULT_COUNTRY,
  isCountry,
  type CountryCode,
} from "../src/lib/country";
import { createCompanyWithDefaults } from "../src/lib/company-seed";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const rawCountry = process.env.COMPANY_COUNTRY;
  const country: CountryCode = isCountry(rawCountry) ? rawCountry : DEFAULT_COUNTRY;

  // Idempotent: a company already exists -> seed already ran.
  const existingCompany = await prisma.company.findFirst();
  if (existingCompany) {
    console.log("Seed already applied - a company exists, so nothing was changed.");
    return;
  }

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const companyName =
    process.env.BOOTSTRAP_COMPANY_NAME ||
    (country === "US" ? "My Company" : "내 회사");

  await prisma.$transaction(async (tx) => {
    const { company, departments, text } = await createCompanyWithDefaults(tx, {
      name: companyName,
      country,
    });

    // The bootstrap admin is a dev convenience only. A fresh install leaves
    // this unset on purpose: the first admin is created through the web-based
    // setup screen instead of a printed password.
    if (!adminPassword) {
      console.log("No BOOTSTRAP_ADMIN_PASSWORD - seeded the company without an admin account. The first admin is created on the setup screen.");
      return;
    }

    const year = new Date().getFullYear();
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminUser = await tx.user.create({
      data: {
        companyId: company.id,
        email: adminEmail,
        name: text.adminName,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const adminEmployee = await tx.employee.create({
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

    const yearPolicies = await tx.leavePolicy.findMany({
      where: { companyId: company.id, kind: { in: [LeaveTypeKind.PTO, LeaveTypeKind.SICK] } },
      select: { id: true, annualDays: true },
    });
    for (const policy of yearPolicies) {
      await tx.leaveBalance.create({
        data: {
          employeeId: adminEmployee.id,
          policyId: policy.id,
          year,
          grantedDays: policy.annualDays,
        },
      });
    }

    console.log(`Bootstrap complete: company "${companyName}", admin ${adminEmail}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
