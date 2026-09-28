import { z } from "zod";
import type { FieldErrors } from "@/lib/auth-validation";
import type { AttendanceValidationMessages } from "@/i18n/dictionaries/attendance";

/**
 * Schema is a locale-aware factory: the messages come from the active
 * dictionary, so validation errors render in the language the user picked.
 * The action builds it with `(await getDict())`.
 */
export function attendanceCorrectionFormSchema(v: AttendanceValidationMessages) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: v.validation.dateRequired,
    }),
    requestType: z.enum(["ADD", "EDIT", "FIX"], {
      error: v.validation.typeRequired,
    }),
    note: z
      .string()
      .trim()
      .min(2, { error: v.validation.reasonRequired })
      .max(500, { error: v.validation.reasonTooLong }),
  });
}

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