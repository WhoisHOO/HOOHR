import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  EmployeeAdmin,
  type ApproverOption,
  type DepartmentView,
  type EmployeeView,
} from "./employee-admin";

export const metadata: Metadata = {
  title: "직원·조직",
};

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EmployeesAdminPage() {
  const admin = await requireAdmin();
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            user: { select: { companyId: true, isActive: true, role: true } },
          },
        },
        _count: { select: { employees: true } },
      },
    }),
    prisma.employee.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            manager: { select: { id: true, name: true } },
          },
        },
        leaveApprover: { select: { id: true, name: true } },
        user: { select: { companyId: true, isActive: true, role: true } },
      },
    }),
  ]);

  const approverOptions: ApproverOption[] = employees
    .filter(
      (employee) =>
        employee.status === "ACTIVE" &&
        employee.user?.companyId === admin.companyId &&
        employee.user.isActive &&
        (employee.user.role === "MANAGER" || employee.user.role === "ADMIN"),
    )
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
    }));

  const departmentViews: DepartmentView[] = departments.map((department) => ({
    id: department.id,
    name: department.name,
    managerId: department.managerId,
    managerName: department.manager?.name ?? null,
    employeeCount: department._count.employees,
  }));

  const employeeViews: EmployeeView[] = employees.map((employee) => {
    const effectiveApprover =
      employee.leaveApprover ?? employee.department?.manager ?? null;
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
      position: employee.position,
      hireDate: toDateInput(employee.hireDate),
      status: employee.status,
      currentApproverId: employee.leaveApproverId,
      currentApproverName: effectiveApprover?.name ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">직원·조직</h1>
        <p className="mt-1 text-sm text-zinc-500">
          부서와 직원 프로필, 승인자, 계정 상태를 관리합니다.
        </p>
      </div>

      <EmployeeAdmin
        departments={departmentViews}
        employees={employeeViews}
        managerOptions={approverOptions}
        approverOptions={approverOptions}
      />
    </div>
  );
}
