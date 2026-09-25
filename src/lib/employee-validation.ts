import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";

const idSchema = z
  .string()
  .trim()
  .min(1, { error: "필수 정보를 입력하세요" })
  .max(100, { error: "필수 정보가 올바르지 않습니다" });

const departmentNameSchema = z
  .string()
  .trim()
  .min(1, { error: "부서명을 입력하세요" })
  .max(100, { error: "부서명은 100자 이내입니다" });

const hireDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "입사일을 선택하세요" })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { error: "입사일이 올바르지 않습니다" },
  );

export const DepartmentCreateSchema = z.object({
  name: departmentNameSchema,
});

export const DepartmentUpdateSchema = z.object({
  id: idSchema,
  name: departmentNameSchema,
  managerId: idSchema.optional(),
});

export const DepartmentDeleteSchema = z.object({
  id: idSchema,
});

export const EmployeeProfileSchema = z.object({
  id: idSchema,
  departmentId: idSchema.optional(),
  position: z
    .string()
    .trim()
    .max(100, { error: "직위는 100자 이내입니다" })
    .optional(),
  hireDate: hireDateSchema.optional(),
  leaveApproverId: idSchema.optional(),
});

export const EmployeeIdSchema = z.object({
  id: idSchema,
});

export const EmployeeStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["ACTIVE", "INACTIVE"], {
    error: "직원 상태가 올바르지 않습니다",
  }),
});

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
