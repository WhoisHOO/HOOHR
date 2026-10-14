"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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
    locale: formData.get("locale"),
    smtpHost: formData.get("smtpHost") || undefined,
    smtpPort: formData.get("smtpPort") || undefined,
    smtpUser: formData.get("smtpUser") || undefined,
    smtpPass: formData.get("smtpPass") || undefined,
    smtpFrom: formData.get("smtpFrom") || undefined,
    smtpSecure: formData.get("smtpSecure") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { companyName, name, email, password, locale } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  // Step 3 is optional: empty strings normalize to null, and a null host
  // disables mail exactly like an unset SMTP_HOST.
  const smtp = {
    smtpHost: parsed.data.smtpHost?.trim() || null,
    smtpPort: parsed.data.smtpPort ?? null,
    smtpUser: parsed.data.smtpUser?.trim() || null,
    smtpPass: parsed.data.smtpPass || null,
    smtpFrom: parsed.data.smtpFrom?.trim() || null,
    smtpSecure: parsed.data.smtpSecure === "on",
  };

  const user = await prisma.$transaction(async (tx) => {
    let company = await tx.company.findFirst();

    // Country/currency/timezone are inert legacy columns: the admin picks the
    // screen language directly, and amounts carry no currency. Keep the seed
    // default so older rows stay consistent.
    if (company) {
      await tx.company.update({
        where: { id: company.id },
        data: { name: companyName, ...smtp },
      });
    } else {
      const rawCountry = process.env.COMPANY_COUNTRY;
      const finalCountry = isCountry(rawCountry) ? rawCountry : DEFAULT_COUNTRY;
      const created = await createCompanyWithDefaults(tx, {
        name: companyName,
        country: finalCountry,
      });
      company = created.company;
      await tx.company.update({ where: { id: company.id }, data: smtp });
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

    // Note: no quotas are tracked anywhere. A leave request is just a
    // request — each company applies its own standards at approval time.

    return createdUser;
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  });

  // The chosen screen language takes effect immediately.
  (await cookies()).set("locale", locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });

  redirect("/hoohr");
}