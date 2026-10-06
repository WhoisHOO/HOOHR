"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Role, EmployeeStatus, LeaveTypeKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDict } from "@/i18n/server";
import { fieldErrors } from "@/lib/form-utils";
import { hasAnyUser } from "@/lib/bootstrap";
import { createSession } from "@/lib/session";
import { createCompanyWithDefaults } from "@/lib/company-seed";
import { setupFormSchema, type SetupState } from "@/lib/setup-validation";
import { DEFAULT_COUNTRY, isCountry } from "@/lib/country";

export async function createFirstAdmin(
  _state: SetupState,
  formData: FormData,
): Promise<SetupState> {
  // First-run only. Once any account exists this action does nothing.
  if (await hasAnyUser()) {
    return { message: "setup already completed" };
  }

  const { common } = await getDict();
  const parsed = setupFormSchema(common.validation).safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { companyName, name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    let company = await tx.company.findFirst();
    let firstDepartmentId: string | undefined;

    if (company) {
      await tx.company.update({
        where: { id: company.id },
        data: { name: companyName },
      });
      const dept = await tx.department.findFirst({
        where: { companyId: company.id },
        orderBy: { id: "asc" },
      });
      firstDepartmentId = dept?.id;
    } else {
      const country = isCountry(process.env.COMPANY_COUNTRY)
        ? process.env.COMPANY_COUNTRY
        : DEFAULT_COUNTRY;
      const created = await createCompanyWithDefaults(tx, {
        name: companyName,
        country,
      });
      company = created.company;
      firstDepartmentId = created.departments[0]?.id;
    }

    const createdUser = await tx.user.create({
      data: {
        companyId: company.id,
        email,
        name,
        passwordHash,
        role: Role.ADMIN,
      },
    });

    await tx.employee.create({
      data: {
        companyId: company.id,
        userId: createdUser.id,
        departmentId: firstDepartmentId,
        name,
        email,
        position: "",
        status: EmployeeStatus.ACTIVE,
      },
    });

    // The admin's own paid-leave balances start from the seeded policies so
    // the admin's own dashboard behaves exactly like the seed admin's did.
    const year = new Date().getFullYear();
    const policies = await tx.leavePolicy.findMany({
      where: { companyId: company.id, kind: { in: [LeaveTypeKind.PTO, LeaveTypeKind.SICK] } },
      select: { id: true, annualDays: true },
    });
    const adminEmployee = await tx.employee.findFirst({
      where: { userId: createdUser.id },
    });
    if (adminEmployee) {
      for (const p of policies) {
        await tx.leaveBalance.create({
          data: {
            employeeId: adminEmployee.id,
            policyId: p.id,
            year,
            grantedDays: p.annualDays,
          },
        });
      }
    }

    return createdUser;
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  });

  redirect("/hoohr");
}
