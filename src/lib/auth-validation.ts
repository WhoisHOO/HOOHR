import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "이메일을 입력하세요" })
    .email({ error: "이메일 형식이 올바르지 않습니다" }),
  password: z.string().min(1, { error: "비밀번호를 입력하세요" }),
});

export const InviteFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "이메일을 입력하세요" })
    .email({ error: "이메일 형식이 올바르지 않습니다" }),
  name: z
    .string()
    .trim()
    .min(2, { error: "이름은 2자 이상 입력하세요" }),
  role: z.enum(["EMPLOYEE", "MANAGER"], {
    error: "역할을 선택하세요",
  }),
});

export const ReinviteEmployeeFormSchema = z.object({
  employeeId: z.string().trim().min(1, { error: "직원을 선택하세요" }),
  role: z.enum(["EMPLOYEE", "MANAGER"], {
    error: "역할을 선택하세요",
  }),
});

export const AcceptInviteFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "이름은 2자 이상 입력하세요" }),
  password: z
    .string()
    .min(8, { error: "비밀번호는 8자 이상이어야 합니다" })
    .regex(/[a-zA-Z]/, { error: "영문자를 포함해야 합니다" })
    .regex(/[0-9]/, { error: "숫자를 포함해야 합니다" }),
});

export type FieldErrors = Record<string, string[] | undefined>;

export type LoginState = {
  fieldErrors?: FieldErrors;
  message?: string;
} | undefined;

export type InviteState = {
  fieldErrors?: FieldErrors;
  message?: string;
  inviteUrl?: string;
} | undefined;

export type AcceptInviteState = {
  fieldErrors?: FieldErrors;
  message?: string;
} | undefined;
