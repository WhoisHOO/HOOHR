import {
  COUNTRY_DEFAULTS,
  type CountryCode,
} from "@/lib/country";
import { LeaveTypeKind, type Prisma } from "@/generated/prisma/client";

/**
 * Seed text per locale. Country is the single install-time answer, so the
 * seed data comes out in that country's language.
 * Categories are gone from the UI; exactly one invisible default bucket is
 * seeded because items still carry a categoryId column.
 */
export const SEED_TEXT: Record<
  string,
  {
    companyName: string;
    adminName: string;
    adminPosition: string;
    policies: {
      name: string;
      kind: LeaveTypeKind;
      annualDays: number;
      maxCarryOverDays: number;
      isPaid: boolean;
    }[];
    categories: string[];
  }
> = {
  ko: {
    companyName: "내 회사",
    adminName: "관리자",
    adminPosition: "대표",
    policies: [
      { name: "연차", kind: LeaveTypeKind.PTO, annualDays: 10, maxCarryOverDays: 5, isPaid: true },
      { name: "병가", kind: LeaveTypeKind.SICK, annualDays: 5, maxCarryOverDays: 0, isPaid: true },
    ],
    categories: ["일반"],
  },
  en: {
    companyName: "My Company",
    adminName: "Admin",
    adminPosition: "CEO",
    policies: [
      { name: "PTO", kind: LeaveTypeKind.PTO, annualDays: 10, maxCarryOverDays: 5, isPaid: true },
      { name: "Sick day", kind: LeaveTypeKind.SICK, annualDays: 5, maxCarryOverDays: 0, isPaid: true },
    ],
    categories: ["General"],
  },
};

/** Create the company plus its starter policies and categories. */
export async function createCompanyWithDefaults(
  tx: Prisma.TransactionClient,
  { name, country }: { name: string; country: CountryCode },
) {
  const { currency, timezone, locale } = COUNTRY_DEFAULTS[country];
  const text = SEED_TEXT[locale];

  const company = await tx.company.create({
    data: { name, country, currency, timezone },
  });

  for (const policy of text.policies) {
    await tx.leavePolicy.create({
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

  for (const name of text.categories) {
    await tx.expenseCategory.create({
      data: { companyId: company.id, name },
    });
  }

  return { company, text };
}