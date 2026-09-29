/**
 * Strings for the outbound notification emails (NOT-1 decisions, NOT-1 invite,
 * NOT-2 approval digest).
 *
 * This namespace is a little different from the UI namespaces: it is read by
 * `src/lib/notifications.ts` on the server rather than rendered by a component,
 * and it is chosen by an explicit `locale` argument instead of the request
 * cookie, because a cron run has no request to read a cookie from.
 *
 * Recipient-facing data (names, amounts, reasons, dates) is never translated.
 * Only the surrounding chrome is. Placeholders use `interpolate`'s `{key}`
 * syntax; an unknown key is left in place verbatim, so every template must be
 * called with the full set of placeholders.
 */

export const notificationsKo = {
  footer: "이 메일은 HOOHR에서 자동으로 발송된 알림입니다.",
  appName: "HOOHR",

  invite: {
    subject: "{app} 초대: {company}에 합류를 요청합니다",
    greeting: "{name}님, 안녕하세요.",
    intro:
      "{company}에서 HOOHR 계정을 만들기 위해 귀하를 초대했습니다. 아래 버튼을 눌러 비밀번호를 설정하시면 바로 사용할 수 있습니다.",
    cta: "초대 수락하기",
    expires: "이 링크는 {date} (UTC)까지 유효합니다. 만료되었다면 관리자에게 다시 초대를 요청하세요.",
    expiryDays: "{n}일 뒤에 만료됩니다.",
  },

  leaveDecision: {
    approvedSubject: "{app}: 휴가 신청이 승인되었습니다",
    rejectedSubject: "{app}: 휴가 신청이 반려되었습니다",
    greeting: "{name}님, 안녕하세요.",
    approvedBody: "{period} / {kind} / {days} 건의 신청이 승인되었습니다.",
    rejectedBody: "{period} / {kind} / {days} 건의 신청이 반려되었습니다.",
    commentLabel: "처리 의견",
    noComment: "(작성된 의견 없음)",
    cta: "휴가 내역 보기",
  },

  expenseDecision: {
    approvedSubject: "{app}: 지출 보고서가 승인되었습니다",
    rejectedSubject: "{app}: 지출 보고서가 반려되었습니다",
    paidSubject: "{app}: 지출이 지급 완료되었습니다",
    greeting: "{name}님, 안녕하세요.",
    approvedBody: "'{title}' 보고서가 승인되었습니다. 지급은 관리자 처리 후 반영됩니다.",
    rejectedBody: "'{title}' 보고서가 반려되었습니다.",
    paidBody: "'{title}' 보고서의 지급이 완료되었습니다.",
    amountLabel: "금액",
    commentLabel: "처리 의견",
    noComment: "(작성된 의견 없음)",
    cta: "지출 내역 보기",
  },

  digest: {
    subject: "{app}: 대기 중인 승인 요청 {count}건",
    greeting: "{name}님, 안녕하세요.",
    intro: "아직 처리되지 않은 승인 요청이 도착해 있습니다.",
    leaveHeading: "휴가 신청",
    expenseHeading: "지출 보고서",
    leaveItem: "- 휴가 {period} / {kind} / {days} — {requester}",
    expenseItem: "- 지출 '{title}' {amount} — {requester}",
    // There is no combined approval inbox: the pending lists live on the leave
    // and expense pages separately, so each section links to its own list
    // rather than to a page that does not exist.
    leaveCta: "휴가 승인 대기 목록 열기",
    expenseCta: "지출 승인 대기 목록 열기",
    emptyNote: "대기 중인 요청이 없습니다.",
    signature: "이 메일은 HOOHR의 알림 Digest입니다.",
  },
};

export type NotificationMessages = typeof notificationsKo;

export const notificationsEn: NotificationMessages = {
  footer: "This is an automated message from HOOHR.",
  appName: "HOOHR",

  invite: {
    subject: "{app} invitation: join {company}",
    greeting: "Hello {name},",
    intro:
      "You have been invited to create a HOOHR account for {company}. Press the button below to set a password and get started.",
    cta: "Accept invitation",
    expires:
      "This link is valid until {date} (UTC). If it expires, ask an administrator to send a new invitation.",
    expiryDays: "It expires in {n} day(s).",
  },

  leaveDecision: {
    approvedSubject: "{app}: your leave request was approved",
    rejectedSubject: "{app}: your leave request was rejected",
    greeting: "Hello {name},",
    approvedBody: "Your request for {kind}, {days} ({period}) was approved.",
    rejectedBody: "Your request for {kind}, {days} ({period}) was rejected.",
    commentLabel: "Reviewer comment",
    noComment: "(no comment left)",
    cta: "View my leave",
  },

  expenseDecision: {
    approvedSubject: "{app}: your expense report was approved",
    rejectedSubject: "{app}: your expense report was rejected",
    paidSubject: "{app}: your expense has been paid",
    greeting: "Hello {name},",
    approvedBody:
      "Your report '{title}' was approved. Payment follows once an administrator processes it.",
    rejectedBody: "Your report '{title}' was rejected.",
    paidBody: "Payment for your report '{title}' is complete.",
    amountLabel: "Amount",
    commentLabel: "Reviewer comment",
    noComment: "(no comment left)",
    cta: "View my expenses",
  },

  digest: {
    subject: "{app}: {count} approval request(s) waiting",
    greeting: "Hello {name},",
    intro: "There are approval requests that have not been handled yet.",
    leaveHeading: "Leave requests",
    expenseHeading: "Expense reports",
    leaveItem: "- Leave {kind}, {days} ({period}) — {requester}",
    expenseItem: "- Expense '{title}' {amount} — {requester}",
    leaveCta: "Open pending leave requests",
    expenseCta: "Open pending expense reports",
    emptyNote: "Nothing is waiting for you.",
    signature: "This is the HOOHR approval digest.",
  },
};
