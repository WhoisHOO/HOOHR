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
    attendanceToday: "오늘 근태",
    notRecorded: "미기록",
    checkIn: "체크인 {time}",
    checkOut: "체크아웃 {time}",
    beforeCheckOut: "체크아웃 전",
    pendingLeave: "승인 대기 휴가",
    myRequests: "본인 신청",
    submittedExpenses: "제출 경비",
    awaitingPayment: "결제 대기",
  },
  next: {
    title: "다음 단계",
    body: "근태 · 휴가 · 경비 모듈이 모두 열렸습니다. 이제 출근 체크, 휴가 신청, 경비 정산을 이용할 수 있습니다.",
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
    attendanceToday: "Today",
    notRecorded: "Not recorded",
    checkIn: "Check-in {time}",
    checkOut: "Check-out {time}",
    beforeCheckOut: "Not checked out",
    pendingLeave: "Leave awaiting approval",
    myRequests: "Your requests",
    submittedExpenses: "Expenses submitted",
    awaitingPayment: "Awaiting payment",
  },
  next: {
    title: "Next steps",
    body: "Attendance, leave and expenses are all live. You can now check in, request leave and file expense claims.",
  },
};
