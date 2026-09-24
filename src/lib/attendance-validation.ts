import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";

export const AttendanceCorrectionFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "날짜를 선택하세요",
  }),
  requestType: z.enum(["ADD", "EDIT", "FIX"], {
    error: "정정 유형을 선택하세요",
  }),
  note: z
    .string()
    .trim()
    .min(2, { error: "정정 사유를 입력하세요" })
    .max(500, { error: "정정 사유는 500자 이내로 입력하세요" }),
});

// 출근/퇴근 버튼 액션의 상태 (메시지 표시용)
export type CheckInOutState = {
  message?: string;
  ok?: boolean;
} | undefined;

// 근태 정정 신청 폼의 상태
export type AttendanceCorrectionState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;

// 근태 정정 승인/반려 폼의 상태
export type CorrectionDecideState = {
  fieldErrors?: FieldErrors;
  message?: string;
  ok?: boolean;
} | undefined;