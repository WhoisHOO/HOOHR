/** First-run setup copy. */

export const setupKo = {
  title: "초기 설정",
  heading: "회사와 관리자 계정 만들기",
  subtitle: "이 화면은 처음 한 번만 보입니다. 3단계까지 마치면 바로 사용할 수 있습니다.",
  steps: {
    company: "1단계 · 회사",
    admin: "2단계 · 관리자",
    mail: "3단계 · 이메일 알림",
  },
  companyHint: "회사가 있는 국가를 고르면 통화·시간대·화면 언어가 자동으로 정해집니다.",
  adminHint: "이 계정이 모든 승인(휴가·영수증)을 처리하는 관리자가 됩니다.",
  mailHint:
    "휴가·영수증 신청이 들어오면 이 주소들로 관리자에게 이메일이 갑니다. 비워 두면 알림 없이 시작하고, 나중에 회사 설정에서 입력할 수 있습니다.",
  fields: {
    companyName: "회사 이름",
    name: "관리자 이름",
    email: "이메일",
    password: "비밀번호 (영문+숫자, 8자 이상)",
    country: "국가 (통화·시간대·언어가 정해집니다)",
    smtpHost: "메일 서버 (예: smtp.gmail.com)",
    smtpPort: "포트 (기본 587)",
    smtpUser: "계정 (없으면 비워 두기)",
    smtpPass: "비밀번호 (없으면 비워 두기)",
    smtpFrom: "보내는 주소 (예: hr@회사도메인)",
    smtpSecure: "465번 포트 SSL 사용",
  },
  countries: {
    KR: "대한민국 (한국어, 원, 아시아/서울)",
    US: "United States (English, USD, America/New_York)",
  },
  next: "다음",
  back: "이전",
  submit: "시작하기",
  submitting: "만드는 중...",
};

export type SetupMessages = typeof setupKo;

export const setupEn: SetupMessages = {
  title: "Initial setup",
  heading: "Create your company and admin account",
  subtitle: "You only see this once. Finish all 3 steps and you are ready to use the app.",
  steps: {
    company: "Step 1 · Company",
    admin: "Step 2 · Admin",
    mail: "Step 3 · Email alerts",
  },
  companyHint: "Pick the country your company is in. Currency, timezone and language follow automatically.",
  adminHint: "This account approves every leave and receipt request.",
  mailHint:
    "When a request arrives, the admins get an email here. Leave it empty to start without alerts — you can fill it in later under Company settings.",
  fields: {
    companyName: "Company name",
    name: "Admin name",
    email: "Email",
    password: "Password (letters + digits, 8+ chars)",
    country: "Country (sets currency, timezone, and language)",
    smtpHost: "Mail server (e.g. smtp.gmail.com)",
    smtpPort: "Port (default 587)",
    smtpUser: "Username (leave empty if none)",
    smtpPass: "Password (leave empty if none)",
    smtpFrom: "From address (e.g. hr@your-domain)",
    smtpSecure: "Use SSL on port 465",
  },
  countries: {
    KR: "South Korea (Korean, KRW, Asia/Seoul)",
    US: "United States (English, USD, America/New_York)",
  },
  next: "Next",
  back: "Back",
  submit: "Get started",
  submitting: "Creating...",
};