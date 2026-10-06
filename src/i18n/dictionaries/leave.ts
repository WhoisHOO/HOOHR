/** Leave module copy. See common.ts for strings shared across modules. */

export const leaveKo = {
  page: {
    title: "휴가",
    subtitle: "연차 · 병가 · 무급휴직 신청 및 승인",
  },
  form: {
    type: "휴가 유형",
    startDate: "시작일",
    endDate: "종료일",
    halfDay: "반차 (0.5일) — 하루만 신청",
    reasonPlaceholder: "예: 의사 예약 (오후 반차)",
    selected: "선택:",
    remaining: "잔여 {n}일",
    optionRemaining: "(잔여 {n}일)",
    submit: "휴가 신청",
    submitting: "신청 중...",
    halfDayBlocked: "선택한 날짜는 주말 또는 공휴일이므로 반차를 신청할 수 없습니다.",
    overBalance:
      "잔여 일수를 초과합니다 ({days}일 > 잔여 {remaining}일). 신청은 가능하며 승인자의 판단에 따릅니다.",
  },
  sections: {
    request: "휴가 신청",
    requestHint: "주말은 제외하고 일수가 계산됩니다. 반차는 0.5일.",
    noPolicy: "등록된 휴가 정책이 없습니다. 관리자에게 문의하세요.",
    myRequests: "내 휴가 신청",
    prevMonth: "이전달",
    nextMonth: "다음달",
    noRequests: "신청 내역이 없습니다.",
    schedule: "{month} 휴가 일정",
    noSchedule: "이번 달 승인된 휴가가 없습니다.",
    holidays: "공휴일: {names}",
    inbox: "승인 대기 휴가 요청 ({count})",
  },
  balance: {
    noRemaining: "잔여 없음",
    grantedUsedAdjusted: "부여 {granted} · 사용 {used} · 조정 {adjusted}",
  },
  badge: {
    halfDay: "(반차)",
  },
  item: {
    comment: "의견: {comment}",
    commentWithAuthor: "의견: {comment} ({name})",
  },
  decide: {
    commentPlaceholder: "승인/반려 의견 (반려 시 필수)",
  },
  messages: {
    pastDatesNotAllowed: "과거 날짜로는 휴가를 신청할 수 없습니다.",
    endBeforeStart: "종료일은 시작일보다 빠를 수 없습니다.",
    halfDaySingleDayOnly: "반차는 하루만 신청할 수 있습니다.",
    policyNotFound: "선택한 휴가 유형(정책)이 존재하지 않습니다.",
    noWorkdays: "선택 기간에 근무일이 없습니다 (주말 또는 공휴일만 포함됨).",
    halfDayOnHoliday: "{name}({m}월 {d}일)는 공휴일이므로 반차를 신청할 수 없습니다.",
    halfDayOnWeekend: "{m}월 {d}일은 주말이므로 반차를 신청할 수 없습니다.",
    insufficientBalance: "{policy} 잔여가 부족합니다 (잔여 {available}일 / 신청 {days}일).",
    requestSubmitted: "휴가 신청이 접수되었습니다.",
    invalidRequest: "요청 정보가 올바르지 않습니다.",
    invalidDecision: "결정 값이 올바르지 않습니다.",
    cannotCancel: "취소할 수 없는 요청입니다 (승인 이후에는 취소 불가).",
    cancelDone: "휴가 신청이 취소되었습니다.",
  },
  balanceImport: {
    emailFormat: "이메일 형식 오류",
    csvRequired: "CSV 파일을 선택해주세요.",
    fileEmpty: "파일이 비어 있습니다.",
    fileNoContent: "파일에 내용이 없습니다.",
    lineFormatError:
      "line {line}: 형식 오류 (email,kind,year,grantedDays[,usedDays,adjustDays])",
    lineNoPolicy: "line {line}: 정책 없음 ({kind})",
    lineNoEmployee: "line {line}: 직원 없음 ({email})",
    imported: "{count}건 가져왔습니다.",
    importedWithErrors: "{count}건 가져왔습니다, 오류 {errors}건 (예: {example}).",
  },
  validation: {
    policyRequired: "휴가 유형을 선택하세요",
    startDateRequired: "시작 날짜를 선택하세요",
    endDateRequired: "종료 날짜를 선택하세요",
    invalidHalfDay: "반차 여부가 올바르지 않습니다",
    reasonTooLong: "사유는 500자 이내로 입력하세요",
  },
};

export type LeaveMessages = typeof leaveKo;

export const leaveEn: LeaveMessages = {
  page: {
    title: "Leave",
    subtitle: "Request and approve annual, sick and unpaid leave",
  },
  form: {
    type: "Leave type",
    startDate: "Start date",
    endDate: "End date",
    halfDay: "Half day (0.5 days) — single day only",
    reasonPlaceholder: "e.g. Doctor appointment (afternoon half day)",
    selected: "Selected:",
    remaining: "{n} day(s) remaining",
    optionRemaining: "({n} day(s) left)",
    submit: "Request leave",
    submitting: "Submitting...",
    halfDayBlocked:
      "Half day is not available on weekends or public holidays.",
    overBalance:
      "Exceeds the remaining balance ({days} day(s) requested, {remaining} day(s) left). You can still submit; the approver decides.",
  },
  sections: {
    request: "Request leave",
    requestHint: "Weekends are excluded when counting days. A half day counts as 0.5 days.",
    noPolicy: "No leave policies are set up. Please contact an administrator.",
    myRequests: "My leave requests",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    noRequests: "No requests yet.",
    schedule: "{month} leave calendar",
    noSchedule: "No approved leave this month.",
    holidays: "Public holidays: {names}",
    inbox: "Leave requests awaiting approval ({count})",
  },
  balance: {
    noRemaining: "No balance left",
    grantedUsedAdjusted: "Granted {granted} · Used {used} · Adjusted {adjusted}",
  },
  badge: {
    halfDay: "(half day)",
  },
  item: {
    comment: "Comment: {comment}",
    commentWithAuthor: "Comment: {comment} ({name})",
  },
  decide: {
    commentPlaceholder: "Comment (required when rejecting)",
  },
  messages: {
    pastDatesNotAllowed: "You cannot request leave for a past date.",
    endBeforeStart: "The end date cannot be earlier than the start date.",
    halfDaySingleDayOnly: "A half day can only be requested for a single day.",
    policyNotFound: "The selected leave type (policy) does not exist.",
    noWorkdays:
      "The selected period has no working days (it only includes weekends or public holidays).",
    halfDayOnHoliday:
      "You cannot request a half day on the public holiday {name} ({m}/{d}).",
    halfDayOnWeekend:
      "You cannot request a half day on {m}/{d} because it falls on a weekend.",
    insufficientBalance:
      "Not enough balance for {policy} (remaining {available} day(s) / requested {days} day(s)).",
    requestSubmitted: "Your leave request has been submitted.",
    invalidRequest: "The request information is not valid.",
    invalidDecision: "The decision value is not valid.",
    cannotCancel:
      "This request cannot be canceled (cancellation is not possible after approval).",
    cancelDone: "Your leave request has been canceled.",
  },
  balanceImport: {
    emailFormat: "Invalid email format",
    csvRequired: "Please choose a CSV file.",
    fileEmpty: "The file is empty.",
    fileNoContent: "The file has no content.",
    lineFormatError:
      "Line {line}: format error (email,kind,year,grantedDays[,usedDays,adjustDays])",
    lineNoPolicy: "Line {line}: no policy ({kind})",
    lineNoEmployee: "Line {line}: no employee ({email})",
    imported: "Imported {count} item(s).",
    importedWithErrors:
      "Imported {count} item(s) with {errors} error(s) (e.g. {example}).",
  },
  validation: {
    policyRequired: "Please choose a leave type",
    startDateRequired: "Please choose a start date",
    endDateRequired: "Please choose an end date",
    invalidHalfDay: "The half-day value is not valid",
    reasonTooLong: "The reason must be 500 characters or fewer",
  },
};

/** Validation copy the leave schema factories need. */
export type LeaveValidationMessages = Pick<
  LeaveMessages,
  "validation" | "balanceImport"
>;