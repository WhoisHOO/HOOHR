/** Attendance module copy. See common.ts for strings shared across modules. */

export const attendanceKo = {
  page: {
    title: "근태",
  },
  sections: {
    prevMonth: "이전달",
    nextMonth: "다음달",
  },
  today: {
    header: "오늘 · {todayLabel}",
    dateLabel: "{date} ({weekday})",
    onWork: "근무 중",
    done: "퇴근 완료",
    notCheckedIn: "미출근",
    line: "출근 {checkIn} · 퇴근 {checkOut}",
    workedValue: "근무 {worked}",
    worked: "근무",
    checkIn: "출근",
    checkOut: "퇴근",
    processing: "처리 중...",
    eventsLabel: "오늘 출입 기록 ({count})",
  },
  records: {
    heading: "{month} 출근 기록",
    empty: "이번 달 기록이 없습니다.",
    colCorrection: "정정",
  },
  team: {
    heading: "팀 근태 현황 · 오늘",
    notRecorded: "미기록",
  },
  requestType: {
    ADD: "기록 누락",
    EDIT: "시간 수정",
    FIX: "기록 오류",
  },
  corrections: {
    heading: "근태 정정 신청",
    subtitle: "기록 누락/오류 시 신청하고 관리자 승인을 받습니다.",
    myRequests: "내 정정 요청",
    noRequests: "정정 요청 내역이 없습니다.",
    comment: "의견: {comment}",
    commentWithAuthor: "의견: {comment} ({name})",
    inbox: "승인 대기 정정 요청 ({count})",
  },
  form: {
    type: "정정 유형",
    reason: "정정 사유",
    notePlaceholder: "예: 9월 20일 출근 버튼을 누르지 않아 기록이 없습니다",
    submitting: "접수 중...",
    submit: "정정 요청",
    typeAdd: "기록 누락 (출근/퇴근 기록이 없음)",
    typeEdit: "시간 수정 (기록된 시간이 오류)",
    typeFix: "기록 오류 (잘못된 날짜/중복 등)",
  },
  decide: {
    commentPlaceholder: "승인/반려 의견 (반려 시 필수)",
  },
  messages: {
    invalidRequest: "요청 정보가 올바르지 않습니다.",
    invalidDecision: "결정 값이 올바르지 않습니다.",
    checkInAlready: "이미 출근 상태입니다. 퇴근 후 다시 출근하실 수 있습니다.",
    checkInDone: "출근 처리되었습니다.",
    checkOutNotOpen: "출근 상태가 아닙니다. 먼저 출근해주세요.",
    checkOutDone: "퇴근 처리되었습니다.",
    futureDateNotAllowed: "미래 날짜로는 정정을 신청할 수 없습니다.",
    noRecordForCorrection:
      "해당 날짜의 출근 기록이 없습니다. '{type}' 유형을 이용하세요.",
    alreadyHasRecord: "해당 날짜에 이미 출근 기록이 있습니다.",
    correctionSubmitted: "정정 요청이 접수되었습니다.",
  },
  validation: {
    dateRequired: "날짜를 선택하세요",
    typeRequired: "정정 유형을 선택하세요",
    reasonRequired: "정정 사유를 입력하세요",
    reasonTooLong: "정정 사유는 500자 이내로 입력하세요",
  },
};

export type AttendanceMessages = typeof attendanceKo;

export const attendanceEn: AttendanceMessages = {
  page: {
    title: "Attendance",
  },
  sections: {
    prevMonth: "Previous month",
    nextMonth: "Next month",
  },
  today: {
    header: "Today · {todayLabel}",
    dateLabel: "{date} ({weekday})",
    onWork: "On work",
    done: "Checked out",
    notCheckedIn: "Not checked in",
    line: "In {checkIn} · Out {checkOut}",
    workedValue: "Worked {worked}",
    worked: "Worked",
    checkIn: "Check in",
    checkOut: "Check out",
    processing: "Working...",
    eventsLabel: "Today's events ({count})",
  },
  records: {
    heading: "{month} check-in records",
    empty: "No records this month.",
    colCorrection: "Correction",
  },
  team: {
    heading: "Team attendance · today",
    notRecorded: "No record",
  },
  requestType: {
    ADD: "Missing record",
    EDIT: "Time correction",
    FIX: "Recording error",
  },
  corrections: {
    heading: "Request a correction",
    subtitle:
      "Request when a record is missing or incorrect, and an administrator approves it.",
    myRequests: "My correction requests",
    noRequests: "No correction requests yet.",
    comment: "Comment: {comment}",
    commentWithAuthor: "Comment: {comment} ({name})",
    inbox: "Corrections awaiting approval ({count})",
  },
  form: {
    type: "Correction type",
    reason: "Reason",
    notePlaceholder: "e.g. I forgot to check in on Sep 20, so there is no record",
    submitting: "Submitting...",
    submit: "Request correction",
    typeAdd: "Missing record (no check-in/check-out)",
    typeEdit: "Edit time (recorded time is wrong)",
    typeFix: "Recording error (wrong date / duplicate, etc.)",
  },
  decide: {
    commentPlaceholder: "Comment (required when rejecting)",
  },
  messages: {
    invalidRequest: "The request information is not valid.",
    invalidDecision: "The decision value is not valid.",
    checkInAlready:
      "You are already checked in. You can check in again after checking out.",
    checkInDone: "Check-in complete.",
    checkOutNotOpen: "You are not checked in. Please check in first.",
    checkOutDone: "Check-out complete.",
    futureDateNotAllowed:
      "You cannot request a correction for a future date.",
    noRecordForCorrection:
      "There is no check-in record for that date. Please use the '{type}' type.",
    alreadyHasRecord: "A check-in record already exists for that date.",
    correctionSubmitted: "Your correction request has been submitted.",
  },
  validation: {
    dateRequired: "Please select a date",
    typeRequired: "Please select a correction type",
    reasonRequired: "Please enter a reason",
    reasonTooLong: "The reason must be 500 characters or fewer",
  },
};

/** Validation copy the attendance schema factories need. */
export type AttendanceValidationMessages = Pick<
  AttendanceMessages,
  "validation"
>;