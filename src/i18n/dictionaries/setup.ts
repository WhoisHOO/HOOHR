/** First-run setup copy. */

export const setupKo = {
  title: "초기 설정",
  heading: "회사와 관리자 계정 만들기",
  subtitle: "이 화면은 처음 한 번만 보입니다. 관리자 계정을 만들면 바로 시작할 수 있습니다.",
  fields: {
    companyName: "회사 이름",
    name: "관리자 이름",
    email: "이메일",
    password: "비밀번호 (영문+숫자, 8자 이상)",
  },
  submit: "시작하기",
  submitting: "만드는 중...",
};

export type SetupMessages = typeof setupKo;

export const setupEn: SetupMessages = {
  title: "Initial setup",
  heading: "Create your company and admin account",
  subtitle: "You only see this once. Create the admin account to get started.",
  fields: {
    companyName: "Company name",
    name: "Admin name",
    email: "Email",
    password: "Password (letters + digits, 8+ chars)",
  },
  submit: "Get started",
  submitting: "Creating...",
};
