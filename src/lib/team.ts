import type { Prisma } from "@/generated/prisma/client";

export type ApprovalReviewer = {
  companyId: string;
  role: string;
  isActive: boolean;
  employeeId: string | null;
  employeeCompanyId: string | null;
  employeeStatus: string | null;
};

export type ApprovalReviewerSource = {
  companyId: string;
  role: string;
  isActive: boolean;
  employee: {
    id: string;
    companyId: string;
    status: string;
  } | null;
};

export type ApprovalReviewerEmployee = {
  id: string;
  companyId: string;
  status: string;
  user: {
    companyId: string;
    role: string;
    isActive: boolean;
  } | null;
};

export type ApproverTarget = {
  leaveApproverId: string | null;
  department: { companyId: string; managerId: string | null } | null;
};

export type ApprovalTarget = {
  companyId: string;
  employeeId: string;
  employee: ApproverTarget & {
    companyId: string;
    leaveApprover: ApprovalReviewerEmployee | null;
    department: (ApproverTarget["department"] & {
      manager: ApprovalReviewerEmployee | null;
    }) | null;
  };
};

export const approvalReviewerSelect = {
  id: true,
  companyId: true,
  role: true,
  isActive: true,
  employee: {
    select: {
      id: true,
      companyId: true,
      status: true,
    },
  },
} satisfies Prisma.UserSelect;

const approverEmployeeSelect = {
  id: true,
  companyId: true,
  status: true,
  user: {
    select: {
      companyId: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.EmployeeSelect;

export const approvalTargetEmployeeInclude = {
  include: {
    department: {
      include: {
        manager: { select: approverEmployeeSelect },
      },
    },
    leaveApprover: { select: approverEmployeeSelect },
  },
} satisfies Prisma.EmployeeDefaultArgs;

export const approvalTargetInclude = {
  employee: approvalTargetEmployeeInclude,
} satisfies { employee: Prisma.EmployeeDefaultArgs };

export function effectiveApproverId(target: ApproverTarget): string | null {
  return target.leaveApproverId === null
    ? target.department?.managerId ?? null
    : target.leaveApproverId;
}

export function isValidApprovalReviewer(
  approver: ApprovalReviewerEmployee | null,
  companyId: string,
): approver is ApprovalReviewerEmployee {
  return (
    approver !== null &&
    approver.companyId === companyId &&
    approver.status === "ACTIVE" &&
    approver.user !== null &&
    approver.user.companyId === companyId &&
    approver.user.isActive &&
    (approver.user.role === "MANAGER" || approver.user.role === "ADMIN")
  );
}

export function approvalReviewerFromUser(
  user: ApprovalReviewerSource,
): ApprovalReviewer {
  return {
    companyId: user.companyId,
    role: user.role,
    isActive: user.isActive,
    employeeId: user.employee?.id ?? null,
    employeeCompanyId: user.employee?.companyId ?? null,
    employeeStatus: user.employee?.status ?? null,
  };
}

export function canActAsAdmin(reviewer: ApprovalReviewer): boolean {
  return (
    reviewer.role === "ADMIN" &&
    reviewer.isActive &&
    (reviewer.employeeId === null || hasActiveEmployee(reviewer))
  );
}

export function canManageEmployees(
  reviewer: ApprovalReviewer,
): reviewer is ApprovalReviewer & { employeeId: string } {
  return (
    reviewer.role === "MANAGER" &&
    reviewer.isActive &&
    hasActiveEmployee(reviewer)
  );
}

export function isApprovalReviewer(reviewer: ApprovalReviewer): boolean {
  return reviewer.role === "ADMIN"
    ? canActAsAdmin(reviewer)
    : canManageEmployees(reviewer);
}

export function canReviewEmployee(
  reviewer: ApprovalReviewer,
  target: ApprovalTarget,
): boolean {
  if (
    target.companyId !== reviewer.companyId ||
    target.employee.companyId !== reviewer.companyId ||
    target.employeeId === reviewer.employeeId
  ) {
    return false;
  }

  if (reviewer.role === "ADMIN") return canActAsAdmin(reviewer);
  if (!canManageEmployees(reviewer)) return false;

  const approverId = effectiveApproverId(target.employee);
  const approver =
    target.employee.leaveApproverId === null
      ? target.employee.department?.manager ?? null
      : target.employee.leaveApprover;

  return (
    approver?.id === approverId &&
    approver.id === reviewer.employeeId &&
    isValidApprovalReviewer(approver, reviewer.companyId)
  );
}

export function managedEmployeeWhere(
  reviewer: ApprovalReviewer,
): Prisma.EmployeeWhereInput {
  if (!canManageEmployees(reviewer)) {
    return { id: { in: [] } };
  }

  return {
    companyId: reviewer.companyId,
    OR: [
      { leaveApproverId: reviewer.employeeId },
      {
        leaveApproverId: null,
        department: {
          companyId: reviewer.companyId,
          managerId: reviewer.employeeId,
        },
      },
    ],
  };
}

export function approvalInboxEmployeeWhere(
  reviewer: ApprovalReviewer,
): Prisma.EmployeeWhereInput {
  const scope = canActAsAdmin(reviewer)
    ? { companyId: reviewer.companyId }
    : managedEmployeeWhere(reviewer);

  if (reviewer.employeeId === null) return scope;
  return {
    AND: [scope, { id: { not: reviewer.employeeId } }],
  };
}

export function teamEmployeeWhere(
  reviewer: ApprovalReviewer,
  includeSelf: boolean,
): Prisma.EmployeeWhereInput {
  if (canActAsAdmin(reviewer)) return { companyId: reviewer.companyId };
  if (!canManageEmployees(reviewer)) return { id: { in: [] } };
  if (!includeSelf) return managedEmployeeWhere(reviewer);

  return {
    OR: [
      managedEmployeeWhere(reviewer),
      {
        id: reviewer.employeeId,
        companyId: reviewer.companyId,
      },
    ],
  };
}

function hasActiveEmployee(
  reviewer: ApprovalReviewer,
): reviewer is ApprovalReviewer & { employeeId: string } {
  return (
    reviewer.employeeId !== null &&
    reviewer.employeeCompanyId === reviewer.companyId &&
    reviewer.employeeStatus === "ACTIVE"
  );
}
