"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Role, EmployeeStatus } from "@/generated/prisma/client";
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
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { companyName, name, email, password, country } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    let company = await tx.company.findFirst();

    if (company) {
      await tx.company.update({
        where: { id: company.id },
        data: { name: companyName, country: country ?? company.country },
      });
    } else {
      const rawCountry = country ?? process.env.COMPANY_COUNTRY;
      const finalCountry = isCountry(rawCountry) ? rawCountry : DEFAULT_COUNTRY;
      const created = await createCompanyWithDefaults(tx, {
        name: companyName,
        country: finalCountry,
      });
      company = created.company;
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
        name,
        email,
        position: "",
        status: EmployeeStatus.ACTIVE,
      },
    });

    // Note: Leave balances are no longer pre-created. They are derived from
    // policy annualDays and approved request days at runtime.

    return createdUser;
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  });

  redirect("/hoohr");
}