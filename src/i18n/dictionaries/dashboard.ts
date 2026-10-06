/** Dashboard copy. See common.ts for strings shared across modules. */

export const dashboardKo = {
  page: {
    title: "대시보드",
  },
  greeting: "안녕하세요, {name}님",
  profile: "{department} · {position} · 입사 {date}",
  gettingStarted: {
    title: "시작하기",
    subtitle: "처음이라면 아래 순서대로 진행하세요.",
    invite: "직원 초대하기",
    policies: "휴가 정책 · 공휴일 확인",
    settings: "회사 정보 확인",
  },
  stats: {
    leave: {
      title: "휴가 · 병가",
      days: "{n}일",
      pending: "승인 대기 {n}건",
    },
    expenses: {
      title: "영수증 처리",
      claims: "{n}건",
      awaiting: "결제 대기",
    },
  },
};

export type DashboardMessages = typeof dashboardKo;

export const dashboardEn: DashboardMessages = {
  page: {
    title: "Dashboard",
  },
  greeting: "Hello, {name}",
  profile: "{department} · {position} · Joined {date}",
  gettingStarted: {
    title: "Getting started",
    subtitle: "New here? Work through these in order.",
    invite: "Invite your team",
    policies: "Review leave policies & holidays",
    settings: "Check company settings",
  },
  stats: {
    leave: {
      title: "Leave & sick days",
      days: "{n} day(s)",
      pending: "Awaiting approval · {n}",
    },
    expenses: {
      title: "Receipts",
      claims: "{n} claim(s)",
      awaiting: "Awaiting payment",
    },
  },
};
