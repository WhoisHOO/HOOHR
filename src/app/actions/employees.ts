"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { parseIsoDate } from "@/lib/attendance";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import {
  departmentCreateSchema,
  departmentDeleteSchema,
  departmentUpdateSchema,
  employeeIdSchema,
  employeeProfileSchema,
  employeeStatusSchema,
  type DepartmentCreateState,
  type DepartmentDeleteState,
  type DepartmentUpdateState,
  type EmployeeProfileState,
  type EmployeeStatusState,
} from "@/lib/employee-validation";
import { prisma } from "@/lib/prisma";
import { getDict } from "@/i18n/server";
import type { AdminMessages } from "@/i18n/dictionaries/admin";

type AdminContext = {
  companyId: string;
  employeeId: string | null;
};

type EmployeeReader = Pick<Prisma.TransactionClient, "employee">;
type DepartmentReader = Pick<Prisma.TransactionClient, "department">;

type EligibleEmployee = {
  id: string;
  status: string;
  user: {
    id: string;
    companyId: string;
    isActive: boolean;
    role: string;
  } | null;
};

async function findEligibleEmployee(
  db: EmployeeReader,
  employeeId: string,
  companyId: string,
): Promise<EligibleEmployee | null> {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      status: true,
      user: {
        select: { id: true, companyId: true, isActive: true, role: true },
      },
    },
  });

  if (
    !employee ||
    employee.status !== "ACTIVE" ||
    !employee.user ||
    !employee.user.isActive ||
    employee.user.companyId !== companyId ||
    (employee.user.role !== "MANAGER" && employee.user.role !== "ADMIN")
  ) {
    return null;
  }

  return employee;
}

async function departmentBelongsToCompany(
  db: DepartmentReader,
  departmentId: string,
  companyId: string,
): Promise<boolean> {
  const department = await db.department.findFirst({
    where: { id: departmentId, companyId },
    select: { id: true },
  });
  return department !== null;
}

function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function revalidateEmployeePages(): void {
  revalidatePath("/hoohr/admin/employees");
  revalidatePath("/hoohr/attendance");
  revalidatePath("/hoohr/leave");
  revalidatePath("/hoohr/expenses");
  revalidatePath("/hoohr");
}

export async function createDepartment(
  _state: DepartmentCreateState,
  formData: FormData,
): Promise<DepartmentCreateState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = departmentCreateSchema(adminDict).safeParse({
    name: formText(formData, "name"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { name } = parsed.data;
  const duplicate = await prisma.department.findFirst({
    where: { companyId: admin.companyId, name },
    select: { id: true },
  });
  if (duplicate) {
    return { message: adminDict.messages.departmentExists, ok: false };
  }

  try {
    await prisma.department.create({
      data: { companyId: admin.companyId, name },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: adminDict.messages.departmentExists, ok: false };
    }
    throw error;
  }

  revalidateEmployeePages();
  return { message: adminDict.messages.departmentCreated, ok: true };
}

export async function updateDepartment(
  _state: DepartmentUpdateState,
  formData: FormData,
): Promise<DepartmentUpdateState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = departmentUpdateSchema(adminDict).safeParse({
    id: formText(formData, "id"),
    name: formText(formData, "name"),
    managerId: formText(formData, "managerId"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { id, name } = parsed.data;
  const managerId = parsed.data.managerId ?? null;
  const department = await prisma.department.findFirst({
    where: { id, companyId: admin.companyId },
    select: { id: true },
  });
  if (!department) {
    return { message: adminDict.messages.departmentNotFound, ok: false };
  }

  if (managerId) {
    const manager = await findEligibleEmployee(prisma, managerId, admin.companyId);
    if (!manager) {
      return {
        fieldErrors: {
          managerId: [adminDict.fieldErrors.managerInvalid],
        },
      };
    }
  }

  const duplicate = await prisma.department.findFirst({
    where: {
      companyId: admin.companyId,
      name,
      id: { not: id },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { message: adminDict.messages.departmentExists, ok: false };
  }

  try {
    await prisma.department.update({
      where: { id: department.id },
      data: { name, managerId },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: adminDict.messages.departmentExists, ok: false };
    }
    throw error;
  }

  revalidateEmployeePages();
  return { message: adminDict.messages.departmentSaved, ok: true };
}

export async function deleteDepartment(
  _state: DepartmentDeleteState,
  formData: FormData,
): Promise<DepartmentDeleteState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = departmentDeleteSchema(adminDict).safeParse({
    id: formText(formData, "id"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const department = await tx.department.findFirst({
      where: { id: parsed.data.id, companyId: admin.companyId },
      select: { id: true, _count: { select: { employees: true } } },
    });
    if (!department) return { kind: "not_found" as const };
    if (department._count.employees > 0) return { kind: "not_empty" as const };

    await tx.department.delete({ where: { id: department.id } });
    return { kind: "deleted" as const };
  });

  if (result.kind === "not_found") {
    return { message: adminDict.messages.departmentNotFound, ok: false };
  }
  if (result.kind === "not_empty") {
    return { message: adminDict.messages.departmentNotEmpty, ok: false };
  }

  revalidateEmployeePages();
  return { message: adminDict.messages.departmentDeleted, ok: true };
}

export async function updateEmployeeProfile(
  _state: EmployeeProfileState,
  formData: FormData,
): Promise<EmployeeProfileState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = employeeProfileSchema(adminDict).safeParse({
    id: formText(formData, "id"),
    departmentId: formText(formData, "departmentId"),
    position: formText(formData, "position"),
    hireDate: formText(formData, "hireDate"),
    leaveApproverId: formText(formData, "leaveApproverId"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { id } = parsed.data;
  const departmentId = parsed.data.departmentId ?? null;
  const leaveApproverId = parsed.data.leaveApproverId ?? null;
  const employee = await prisma.employee.findFirst({
    where: { id, companyId: admin.companyId },
    select: { id: true },
  });
  if (!employee) {
    return { message: adminDict.messages.employeeNotFound, ok: false };
  }

  if (departmentId && !(await departmentBelongsToCompany(prisma, departmentId, admin.companyId))) {
    return {
      fieldErrors: { departmentId: [adminDict.fieldErrors.departmentUnavailable] },
    };
  }

  if (leaveApproverId === employee.id) {
    return {
      fieldErrors: { leaveApproverId: [adminDict.fieldErrors.cannotSelfApprove] },
    };
  }

  if (
    leaveApproverId &&
    !(await findEligibleEmployee(prisma, leaveApproverId, admin.companyId))
  ) {
    return {
      fieldErrors: {
        leaveApproverId: [adminDict.fieldErrors.approverInvalid],
      },
    };
  }

  const hireDate = parsed.data.hireDate ? parseIsoDate(parsed.data.hireDate) : null;
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      departmentId,
      position: parsed.data.position ?? null,
      hireDate,
      leaveApproverId,
    },
  });

  revalidateEmployeePages();
  return { message: adminDict.messages.employeeProfileSaved, ok: true };
}

async function changeEmployeeStatus(
  admin: AdminContext,
  adminDict: AdminMessages,
  employeeId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<EmployeeStatusState> {
  if (status === "INACTIVE" && admin.employeeId === employeeId) {
    return {
      message: adminDict.messages.cannotDeactivateSelf,
      ok: false,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId: admin.companyId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { id: true, companyId: true } },
      },
    });
    if (!employee) return { kind: "not_found" as const, message: "" };

    if (status === "ACTIVE" && employee.status === "INVITED") {
      return {
        kind: "message" as const,
        message: adminDict.messages.cannotActivateInvited,
      };
    }
    if (status === "ACTIVE" && !employee.userId) {
      return {
        kind: "message" as const,
        message: adminDict.messages.cannotReactivateNoAccount,
      };
    }
    if (status === "INACTIVE" && employee.status !== "ACTIVE") {
      return {
        kind: "message" as const,
        message: adminDict.messages.alreadyInactive,
      };
    }
    if (status === "ACTIVE" && employee.status !== "INACTIVE") {
      return {
        kind: "message" as const,
        message: adminDict.messages.alreadyActive,
      };
    }
    if (employee.userId && (!employee.user || employee.user.companyId !== admin.companyId)) {
      return {
        kind: "message" as const,
        message: adminDict.messages.linkedAccountInvalid,
      };
    }

    await tx.employee.update({
      where: { id: employee.id },
      data: { status },
    });
    if (employee.userId) {
      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: status === "ACTIVE" },
      });
    }
    return { kind: "ok" as const, message: "" };
  });

  if (result.kind !== "ok") {
    return {
      message: result.message || adminDict.messages.statusChangeFailed,
      ok: false,
    };
  }

  revalidateEmployeePages();
  return {
    message:
      status === "ACTIVE"
        ? adminDict.messages.employeeReactivated
        : adminDict.messages.employeeDeactivated,
    ok: true,
  };
}

export async function deactivateEmployee(
  _state: EmployeeStatusState,
  formData: FormData,
): Promise<EmployeeStatusState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = employeeIdSchema(adminDict).safeParse({
    id: formText(formData, "id"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }
  return changeEmployeeStatus(admin, adminDict, parsed.data.id, "INACTIVE");
}

export async function reactivateEmployee(
  _state: EmployeeStatusState,
  formData: FormData,
): Promise<EmployeeStatusState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = employeeIdSchema(adminDict).safeParse({
    id: formText(formData, "id"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }
  return changeEmployeeStatus(admin, adminDict, parsed.data.id, "ACTIVE");
}

export async function updateEmployeeStatus(
  _state: EmployeeStatusState,
  formData: FormData,
): Promise<EmployeeStatusState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = employeeStatusSchema(adminDict).safeParse({
    id: formText(formData, "id"),
    status: formText(formData, "status"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }
  return changeEmployeeStatus(admin, adminDict, parsed.data.id, parsed.data.status);
}
