export const navKo = {
  dashboard: "대시보드",
  leave: "휴가",
  expenses: "경비",
  // 직원의 메뉴는 딱 두 가지 행동만 보여준다.
  leaveRequest: "휴가 신청",
  expenseSubmit: "영수증 제출",
  adminSection: "관리자",
  employees: "직원·조직",
  invite: "직원 초대",
  settings: "회사 설정",
  logout: "로그아웃",
};

export type NavMessages = typeof navKo;

export const navEn: NavMessages = {
  dashboard: "Dashboard",
  leave: "Leave",
  expenses: "Expenses",
  leaveRequest: "Request leave",
  expenseSubmit: "Submit receipts",
  adminSection: "Admin",
  employees: "Employees & org",
  invite: "Invite employees",
  settings: "Company settings",
  logout: "Sign out",
};
