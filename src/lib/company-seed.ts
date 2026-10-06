import {
  COUNTRY_DEFAULTS,
  type CountryCode,
} from "@/lib/country";
import { LeaveTypeKind, type Prisma } from "@/generated/prisma/client";

/**
 * Seed text per locale. Country is the single install-time answer, so the
 * seed data (department names, policy names, category names) comes out in
 * that country's language - a US company should not boot into "교통/식비".
 * Leave day counts are starting values the admin edits in Settings, not a
 * legal entitlement for the country.
 */
export const SEED_TEXT: Record<
  string,
  {
    companyName: string;
    adminName: string;
    adminPosition: string;
    departments: string[];
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

/** Create the company plus its starter departments, policies and categories. */
export async function createCompanyWithDefaults(
  tx: Prisma.TransactionClient,
  { name, country }: { name: string; country: CountryCode },
) {
  const { currency, timezone, locale } = COUNTRY_DEFAULTS[country];
  const text = SEED_TEXT[locale];

  const company = await tx.company.create({
    data: { name, country, currency, timezone },
  });

  const departments: { id: string; name: string }[] = [];
  for (const name of text.departments) {
    const d = await tx.department.create({
      data: { companyId: company.id, name },
    });
    departments.push(d);
  }

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

  return { company, departments, text };
}
