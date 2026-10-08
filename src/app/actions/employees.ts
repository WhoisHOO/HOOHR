"use server";

import { revalidatePath } from "next/cache";
import { parseIsoDate } from "@/lib/date";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";
import {
  employeeIdSchema,
  employeeProfileSchema,
  employeeStatusSchema,
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

function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function revalidateEmployeePages(): void {
  revalidatePath("/hoohr/admin/employees");
  revalidatePath("/hoohr/leave");
  revalidatePath("/hoohr/expenses");
  revalidatePath("/hoohr");
}

export async function updateEmployeeProfile(
  _state: EmployeeProfileState,
  formData: FormData,
): Promise<EmployeeProfileState> {
  const admin = await requireAdmin();
  const { admin: adminDict } = await getDict();
  const parsed = employeeProfileSchema(adminDict).safeParse({
    id: formText(formData, "id"),
    position: formText(formData, "position"),
    hireDate: formText(formData, "hireDate"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { id } = parsed.data;
  const employee = await prisma.employee.findFirst({
    where: { id, companyId: admin.companyId },
    select: { id: true },
  });
  if (!employee) {
    return { message: adminDict.messages.employeeNotFound, ok: false };
  }

  const hireDate = parsed.data.hireDate ? parseIsoDate(parsed.data.hireDate) : null;
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      position: parsed.data.position ?? null,
      hireDate,
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