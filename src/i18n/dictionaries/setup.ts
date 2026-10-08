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
    country: "국가 (통화·시간대·언어가 정해집니다)",
  },
  countries: {
    KR: "대한민국 (한국어, 원, 아시아/서울)",
    US: "United States (English, USD, America/New_York)",
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
    country: "Country (sets currency, timezone, and language)",
  },
  countries: {
    KR: "South Korea (Korean, KRW, Asia/Seoul)",
    US: "United States (English, USD, America/New_York)",
  },
  submit: "Get started",
  submitting: "Creating...",
};