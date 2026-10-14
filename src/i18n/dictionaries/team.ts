/** Company directory (roster). Flat list grouped by role — there is no
 * department/manager hierarchy to draw a tree from. */

export const teamKo = {
  page: {
    title: "직원",
    subtitle: "우리 회사 사람들입니다.",
  },
  admins: "관리자",
  employees: "직원",
  empty: "등록된 직원이 없습니다.",
};

export type TeamMessages = typeof teamKo;

export const teamEn: TeamMessages = {
  page: {
    title: "Team",
    subtitle: "The people in our company.",
  },
  admins: "Admins",
  employees: "Employees",
  empty: "No employees yet.",
};
