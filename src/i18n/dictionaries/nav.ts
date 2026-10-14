export const navKo = {
  dashboard: "대시보드",
  leave: "휴가",
  expenses: "경비",
  team: "직원",
  // 직원의 메뉴는 신청 두 가지 + 명부. 그 외(대시보드·관리 메뉴)는 보여주지
  // 않는다 — 첫 사용자가 "뭐부터 하지"를 물을 일이 없게.
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
  team: "Team",
  leaveRequest: "Request leave",
  expenseSubmit: "Submit receipts",
  adminSection: "Admin",
  employees: "Employees & org",
  invite: "Invite employees",
  settings: "Company settings",
  logout: "Sign out",
};
