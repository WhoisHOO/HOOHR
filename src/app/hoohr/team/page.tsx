import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { team } = await getDict();
  return { title: team.page.title };
}

function statusBadge(status: string, active: string, invited: string, inactive: string) {
  const color =
    status === "ACTIVE"
      ? "bg-green-100 text-green-700"
      : status === "INVITED"
        ? "bg-amber-100 text-amber-700"
        : "bg-zinc-100 text-zinc-600";
  const label = status === "ACTIVE" ? active : status === "INVITED" ? invited : inactive;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export default async function TeamPage() {
  const user = await requireUser();
  const { common, admin, team } = await getDict();

  const employees = await prisma.employee.findMany({
    where: { companyId: user.companyId },
    include: { user: { select: { role: true } } },
    orderBy: { name: "asc" },
  });

  const admins = employees.filter((e) => e.user?.role === "ADMIN");
  const rest = employees.filter((e) => e.user?.role !== "ADMIN");

  const renderRow = (e: (typeof employees)[number]) => (
    <li
      key={e.id}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-4 py-3 text-sm"
    >
      <span className="font-medium text-zinc-800">{e.name}</span>
      <span className="text-zinc-500">{e.email}</span>
      <span className="ml-auto">
        {statusBadge(
          e.status,
          common.employmentStatus.ACTIVE,
          common.employmentStatus.INVITED,
          admin.status.inactive,
        )}
      </span>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{team.page.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{team.page.subtitle}</p>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-zinc-500">{team.empty}</p>
      ) : (
        <>
          {admins.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-900">{team.admins}</h2>
              <ul className="mt-3 space-y-2">{admins.map(renderRow)}</ul>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-900">{team.employees}</h2>
              <ul className="mt-3 space-y-2">{rest.map(renderRow)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
