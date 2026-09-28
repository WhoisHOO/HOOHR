import type { CommonMessages } from "./common";

export const authKo = {
  login: {
    title: "로그인",
    subtitle: "근태 · 휴가 · 경비 관리에 로그인하세요",
    submit: "로그인",
    submitting: "로그인 중...",
    invalid: "이메일 또는 비밀번호가 올바르지 않습니다",
  },
  accept: {
    title: "초대 수락",
    heading: "HOOHR 가입",
    subtitle: "이름과 비밀번호를 설정하면 바로 시작할 수 있어요",
    invitedBy: "{company}에서 초대했습니다",
    passwordHint: "8자 이상, 영문·숫자 포함",
    submit: "가입하고 시작하기",
    submitting: "처리 중...",
    invalidLink: "유효하지 않은 초대 링크입니다. 관리자에게 새 링크를 요청하세요.",
    expiredLink:
      "초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 링크를 요청하세요.",
  },
  invite: {
    title: "직원 초대",
    heading: "직원 초대",
    roleEmployee: "직원 (본인 데이터만)",
    roleManager: "매니저 (팀 승인 권한)",
    submit: "초대 링크 생성",
    submitting: "초대 링크 생성 중...",
    created: "초대 링크가 생성되었습니다",
    createdFor: "{name}({email}) 초대 링크 생성됨 (7일 유효)",
  },
  messages: {
    emailExists: "이미 등록된 이메일입니다",
    notInvited: "초대 대기 중인 직원만 다시 초대할 수 있습니다.",
    noLongerInvited: "더 이상 초대 대기 상태가 아닌 직원입니다.",
    inviteUsed: "초대 링크가 만료되었거나 이미 사용되었습니다",
  },
};

export type AuthMessages = typeof authKo;

export const authEn: AuthMessages = {
  login: {
    title: "Sign in",
    subtitle: "Sign in to manage attendance, leave and expenses",
    submit: "Sign in",
    submitting: "Signing in...",
    invalid: "That email or password is not correct",
  },
  accept: {
    title: "Accept invitation",
    heading: "Join HOOHR",
    subtitle: "Set your name and password to get started",
    invitedBy: "You have been invited by {company}",
    passwordHint: "At least 8 characters, including a letter and a digit",
    submit: "Join and start",
    submitting: "Working...",
    invalidLink:
      "This invitation link is not valid. Please ask an administrator for a new one.",
    expiredLink:
      "This invitation link has expired or has already been used. Please ask an administrator for a new one.",
  },
  invite: {
    title: "Invite employees",
    heading: "Invite employees",
    roleEmployee: "Employee (own data only)",
    roleManager: "Manager (can approve their team)",
    submit: "Create invite link",
    submitting: "Creating invite link...",
    created: "Invite link created",
    createdFor: "Invite link created for {name} ({email}) (valid for 7 days)",
  },
  messages: {
    emailExists: "That email is already registered",
    notInvited: "Only employees awaiting an invite can be re-invited.",
    noLongerInvited: "That employee is no longer awaiting an invite.",
    inviteUsed: "This invitation link has expired or has already been used",
  },
};

/** Validation copy the auth schemas need, so the schema factory can read it. */
export type AuthValidationMessages = Pick<
  CommonMessages["validation"],
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordMin"
  | "passwordNeedsLetter"
  | "passwordNeedsDigit"
  | "nameMin"
  | "roleRequired"
>;
