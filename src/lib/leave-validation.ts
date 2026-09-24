import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";

export const LeaveRequestFormSchema = z.object({
  policyId: z.string().min(1, { error: "휴가 유형을 선택하세요" }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "시작 날짜를 선택하세요",
  }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "종료 날짜를 선택하세요",
  }),
  isHalfDay: z.enum(["true", "1", "on"], { error: "반차 여부가 올바르지 않습니다" }).optional(),
  reason: z
    .string()
    .trim()
    .max(500, { error: "사유는 500자 이내로 입력하세요" })
    .optional(),
});

export type LeaveRequestState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type LeaveDecideState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

export type LeaveCancelState = {
  message?: string;
  ok?: boolean;
} | undefined;

export type BalanceImportState = {
  message?: string;
  ok?: boolean;
} | undefined;