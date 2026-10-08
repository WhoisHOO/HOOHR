import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  EmployeeAdmin,
  type EmployeeView,
} from "./employee-admin";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDict();
  return { title: admin.employees.title };
}

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EmployeesAdminPage() {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const employees = await prisma.employee.findMany({
    where: { companyId: admin.companyId },
    orderBy: { name: "asc" },
    include: {
      user: { select: { companyId: true, isActive: true, role: true } },
    },
  });

  const employeeViews: EmployeeView[] = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    position: employee.position,
    hireDate: toDateInput(employee.hireDate),
    status: employee.status,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{adminDict.employees.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {adminDict.employees.subtitle}
        </p>
      </div>

      <EmployeeAdmin employees={employeeViews} />
    </div>
  );
}