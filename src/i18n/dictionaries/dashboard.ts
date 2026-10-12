/** Dashboard copy. See common.ts for strings shared across modules. */

export const dashboardKo = {
  page: {
    title: "대시보드",
  },
  greeting: "안녕하세요, {name}님",
  profile: "{position} · 입사 {date}",
  gettingStarted: {
    title: "시작하기",
    subtitle: "직원을 초대하면 바로 사용할 수 있습니다.",
    action: "직원 초대하기",
  },
  // 직원 대시보드: 두 개의 큰 행동 버튼 + 내 대기 건수. 그 이상은 없다.
  myActions: {
    leaveTitle: "휴가 신청하기",
    leaveHint: "PTO · 병가 · 무급, 메모와 함께",
    expenseTitle: "영수증 제출하기",
    expenseHint: "사진을 올리고 메모와 함께",
    pendingLeave: "승인 대기 {n}건",
    pendingExpense: "제출 {n}건",
  },
  // 관리자 대시보드: 남은 일은 승인뿐이다.
  queue: {
    title: "승인 대기",
    leavePending: "휴가 {n}건",
    expensePending: "영수증 {n}건",
    empty: "대기 중인 요청이 없습니다.",
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
  profile: "{position} · Joined {date}",
  gettingStarted: {
    title: "Getting started",
    subtitle: "Invite your team and you are ready to go.",
    action: "Invite your team",
  },
  myActions: {
    leaveTitle: "Request leave",
    leaveHint: "PTO · sick · unpaid, with a note",
    expenseTitle: "Submit receipts",
    expenseHint: "Snap a photo, add a note",
    pendingLeave: "{n} awaiting approval",
    pendingExpense: "{n} submitted",
  },
  queue: {
    title: "Waiting for approval",
    leavePending: "{n} leave",
    expensePending: "{n} receipts",
    empty: "Nothing is waiting.",
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
