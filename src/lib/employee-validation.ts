import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";
import type { AdminValidationMessages } from "@/i18n/dictionaries/admin";

/**
 * Schemas are locale-aware factories: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * Actions build them with `(await getDict())`.
 */
function idSchema(v: AdminValidationMessages) {
  return z
    .string()
    .trim()
    .min(1, { error: v.validation.requiredInfo })
    .max(100, { error: v.validation.invalidInfo });
}

function departmentNameSchema(v: AdminValidationMessages) {
  return z
    .string()
    .trim()
    .min(1, { error: v.validation.departmentNameRequired })
    .max(100, { error: v.validation.departmentNameTooLong });
}

function hireDateSchema(v: AdminValidationMessages) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: v.validation.hireDateRequired })
    .refine(
      (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      },
      { error: v.validation.hireDateInvalid },
    );
}

export function departmentCreateSchema(v: AdminValidationMessages) {
  return z.object({
    name: departmentNameSchema(v),
  });
}

export function departmentUpdateSchema(v: AdminValidationMessages) {
  return z.object({
    id: idSchema(v),
    name: departmentNameSchema(v),
    managerId: idSchema(v).optional(),
  });
}

export function departmentDeleteSchema(v: AdminValidationMessages) {
  return z.object({
    id: idSchema(v),
  });
}

export function employeeProfileSchema(v: AdminValidationMessages) {
  return z.object({
    id: idSchema(v),
    departmentId: idSchema(v).optional(),
    position: z
      .string()
      .trim()
      .max(100, { error: v.validation.positionTooLong })
      .optional(),
    hireDate: hireDateSchema(v).optional(),
    leaveApproverId: idSchema(v).optional(),
  });
}

export function employeeIdSchema(v: AdminValidationMessages) {
  return z.object({
    id: idSchema(v),
  });
}

export function employeeStatusSchema(v: AdminValidationMessages) {
  return z.object({
    id: idSchema(v),
    status: z.enum(["ACTIVE", "INACTIVE"], {
      error: v.validation.statusInvalid,
    }),
  });
}

export type EmployeeAdminState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type DepartmentCreateState = EmployeeAdminState;
export type DepartmentUpdateState = EmployeeAdminState;
export type DepartmentDeleteState = EmployeeAdminState;
export type EmployeeProfileState = EmployeeAdminState;
export type EmployeeStatusState = EmployeeAdminState;
export type DepartmentActionState = EmployeeAdminState;
export type EmployeeActionState = EmployeeAdminState;