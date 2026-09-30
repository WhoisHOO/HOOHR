/** Dashboard copy. See common.ts for strings shared across modules. */

export const dashboardKo = {
  page: {
    title: "대시보드",
  },
  greeting: "안녕하세요, {name}님",
  profile: "{department} · {position} · 입사 {date}",
  stats: {
    ptoRemaining: "연차 잔여",
    ptoGrantedUsed: "발생 {granted}일 · 사용 {used}일",
    pendingLeave: "승인 대기 휴가",
    myRequests: "본인 신청",
    submittedExpenses: "제출 경비",
    awaitingPayment: "결제 대기",
  },
  next: {
    title: "다음 단계",
    body: "휴가 · 경비 모듈이 모두 열렸습니다. 이제 휴가 신청과 경비 정산을 이용할 수 있습니다.",
  },
};

export type DashboardMessages = typeof dashboardKo;

export const dashboardEn: DashboardMessages = {
  page: {
    title: "Dashboard",
  },
  greeting: "Hello, {name}",
  profile: "{department} · {position} · Joined {date}",
  stats: {
    ptoRemaining: "Annual leave left",
    ptoGrantedUsed: "Granted {granted} days · Used {used} days",
    pendingLeave: "Leave awaiting approval",
    myRequests: "Your requests",
    submittedExpenses: "Expenses submitted",
    awaitingPayment: "Awaiting payment",
  },
  next: {
    title: "Next steps",
    body: "Leave and expenses are both live. You can now request leave and file expense claims.",
  },
};
