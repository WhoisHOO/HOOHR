import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { getDict } from "@/i18n/server";
import { SettingsClient, type PolicyView, type CategoryView } from "./settings-client";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getDict();
  return { title: settings.page.title };
}

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const { common, settings } = await getDict();

  const [company, policies, categories] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: admin.companyId },
      select: {
        name: true,
        country: true,
        weekendDays: true,
      },
    }),
    prisma.leavePolicy.findMany({
      where: { companyId: admin.companyId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.expenseCategory.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const policyViews: PolicyView[] = policies.map((policy) => ({
    id: policy.id,
    name: policy.name,
    kind: policy.kind,
    kindLabel: common.leaveKind[policy.kind] ?? policy.kind,
    annualDays: policy.annualDays,
    maxCarryOverDays: policy.maxCarryOverDays,
    isPaid: policy.isPaid,
    requiresApproval: policy.requiresApproval,
    active: policy.active,
  }));

  const categoryViews: CategoryView[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    itemCount: category._count.items,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{settings.page.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{settings.page.subtitle}</p>
      </div>

      <SettingsClient
        companyName={company.name}
        country={company.country}
        weekendDays={company.weekendDays}
        policies={policyViews}
        categories={categoryViews}
      />
    </div>
  );
}