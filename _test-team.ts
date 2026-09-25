import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
import type { Prisma } from "./src/generated/prisma/client";
import {
  approvalInboxEmployeeWhere,
  approvalReviewerFromUser,
  approvalReviewerSelect,
  approvalTargetEmployeeInclude,
  canReviewEmployee,
  effectiveApproverId,
  isApprovalReviewer,
  managedEmployeeWhere,
  teamEmployeeWhere,
} from "./src/lib/team";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const stamp = Date.now().toString(36);
const results: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(
    `${ok ? "PASS" : "FAIL"} ${label} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`,
  );
}

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com" },
    include: { employee: true },
  });
  if (!admin?.employee) throw new Error("no admin employee");
  const adminEmployeeId = admin.employee.id;
  const companyId = admin.companyId;
  const passwordHash = await bcrypt.hash("Test1234!", 10);

  // --- fixtures --------------------------------------------------------------
  await cleanFixtures();

  const otherCompany = await prisma.company.create({
    data: { name: `ZZ-Other-${stamp}`, timezone: "UTC" },
  });

  async function createUser(
    label: string,
    role: "EMPLOYEE" | "MANAGER" | "ADMIN",
  ) {
    const email = `${label}-${stamp}@test.local`;
    const user = await prisma.user.create({
      data: { companyId, email, name: label, passwordHash, role },
    });
    const employee = await prisma.employee.create({
      data: { companyId, userId: user.id, name: label, email, status: "ACTIVE" },
    });
    return { user, employee };
  }

  const managerA = await createUser("mgr-a", "MANAGER");
  const managerB = await createUser("mgr-b", "MANAGER");
  const memberDept = await createUser("mem-dept", "EMPLOYEE");
  const memberExplicit = await createUser("mem-explicit", "EMPLOYEE");
  const outsiderB = await createUser("out-b", "EMPLOYEE");
  const pseudoManagerC = await createUser("pseudo-c", "EMPLOYEE");
  const memberC = await createUser("mem-c", "EMPLOYEE");

  const deptA = await prisma.department.create({
    data: { companyId, name: `QA-A-${stamp}`, managerId: managerA.employee.id },
  });
  const deptB = await prisma.department.create({
    data: { companyId, name: `QA-B-${stamp}`, managerId: managerB.employee.id },
  });
  // deptC is "managed" by a user whose role is EMPLOYEE, so it is not reviewable.
  const deptC = await prisma.department.create({
    data: { companyId, name: `QA-C-${stamp}`, managerId: pseudoManagerC.employee.id },
  });

  await prisma.employee.update({
    where: { id: memberDept.employee.id },
    data: { departmentId: deptA.id },
  });
  await prisma.employee.update({
    where: { id: memberExplicit.employee.id },
    data: { departmentId: deptA.id, leaveApproverId: managerB.employee.id },
  });
  await prisma.employee.update({
    where: { id: outsiderB.employee.id },
    data: { departmentId: deptB.id },
  });
  await prisma.employee.update({
    where: { id: memberC.employee.id },
    data: { departmentId: deptC.id },
  });

  const otherManagerUser = await prisma.user.create({
    data: {
      companyId: otherCompany.id,
      email: `mgr-other-${stamp}@test.local`,
      name: "Other Manager",
      passwordHash,
      role: "MANAGER",
    },
  });
  await prisma.employee.create({
    data: {
      companyId: otherCompany.id,
      userId: otherManagerUser.id,
      name: "Other Manager",
      email: `mgr-other-${stamp}@test.local`,
      status: "ACTIVE",
    },
  });

  const reviewerFor = async (userId: string) =>
    approvalReviewerFromUser(
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: approvalReviewerSelect,
      }),
    );

  /** Mirrors how the decide actions consume a request: a row that owns `employee`. */
  const targetFor = async (employeeId: string) => {
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      ...approvalTargetEmployeeInclude,
    });
    return { companyId: employee.companyId, employeeId: employee.id, employee };
  };

  const managedIds = async (where: Prisma.EmployeeWhereInput) =>
    (await prisma.employee.findMany({ where, select: { id: true } }))
      .map((employee) => employee.id)
      .sort();

  // --- 1) approver resolution ----------------------------------------------
  const targetDept = await targetFor(memberDept.employee.id);
  const targetExplicit = await targetFor(memberExplicit.employee.id);
  check(
    "effectiveApproverId falls back to department manager",
    effectiveApproverId(targetDept.employee),
    managerA.employee.id,
  );
  check(
    "explicit leaveApproverId wins over department manager",
    effectiveApproverId(targetExplicit.employee),
    managerB.employee.id,
  );

  // --- 2) reviewer role gate -------------------------------------------------
  const adminReviewer = await reviewerFor(admin.id);
  const managerAReviewer = await reviewerFor(managerA.user.id);
  const managerBReviewer = await reviewerFor(managerB.user.id);
  const memberReviewer = await reviewerFor(memberDept.user.id);
  const otherReviewer = await reviewerFor(otherManagerUser.id);

  check("ADMIN is an approval reviewer", isApprovalReviewer(adminReviewer), true);
  check("MANAGER is an approval reviewer", isApprovalReviewer(managerAReviewer), true);
  check("EMPLOYEE is not an approval reviewer", isApprovalReviewer(memberReviewer), false);

  // --- 3) canReviewEmployee --------------------------------------------------
  const targetManagerA = await targetFor(managerA.employee.id);
  const targetC = await targetFor(memberC.employee.id);
  const forcedPseudoManager: Awaited<ReturnType<typeof reviewerFor>> = {
    ...(await reviewerFor(pseudoManagerC.user.id)),
    role: "MANAGER",
  };

  check("department manager may review a team member", canReviewEmployee(managerAReviewer, targetDept), true);
  check(
    "manager may not review a member explicitly reassigned elsewhere",
    canReviewEmployee(managerAReviewer, targetExplicit),
    false,
  );
  check("explicit approver may review the member", canReviewEmployee(managerBReviewer, targetExplicit), true);
  check(
    "explicit approver may not review a department-managed member",
    canReviewEmployee(managerBReviewer, targetDept),
    false,
  );
  check("manager may not review themselves", canReviewEmployee(managerAReviewer, targetManagerA), false);
  check("EMPLOYEE role may not review", canReviewEmployee(memberReviewer, targetExplicit), false);
  check("other-company manager may not review", canReviewEmployee(otherReviewer, targetDept), false);
  check(
    "row whose company does not match the reviewer's is refused",
    canReviewEmployee(managerAReviewer, { ...targetDept, companyId: otherCompany.id }),
    false,
  );
  check(
    "department manager without MANAGER/ADMIN role may not review",
    canReviewEmployee(forcedPseudoManager, targetC),
    false,
  );
  check("admin may review any employee in the company", canReviewEmployee(adminReviewer, targetC), true);
  check(
    "admin may not review themselves",
    canReviewEmployee(adminReviewer, await targetFor(adminEmployeeId)),
    false,
  );

  // --- 4) team scoping queries ---------------------------------------------
  check(
    "managedEmployeeWhere(A) = department-only member",
    await managedIds(managedEmployeeWhere(managerAReviewer)),
    [memberDept.employee.id],
  );
  check(
    "managedEmployeeWhere(B) = explicit approver + department member",
    await managedIds(managedEmployeeWhere(managerBReviewer)),
    [memberExplicit.employee.id, outsiderB.employee.id].sort(),
  );
  check("managedEmployeeWhere(EMPLOYEE) is empty", await managedIds(managedEmployeeWhere(memberReviewer)), []);
  check(
    "approval inbox excludes the reviewer themselves",
    await managedIds(approvalInboxEmployeeWhere(managerAReviewer)),
    [memberDept.employee.id],
  );
  check(
    "admin inbox is company-wide",
    await managedIds(approvalInboxEmployeeWhere(adminReviewer)).then((ids) =>
      ids.includes(outsiderB.employee.id) && !ids.includes(adminEmployeeId),
    ),
    true,
  );
  check(
    "teamEmployeeWhere(includeSelf) contains self and team",
    await managedIds(teamEmployeeWhere(managerAReviewer, true)).then((ids) => [
      ids.includes(managerA.employee.id),
      ids.includes(memberDept.employee.id),
    ]),
    [true, true],
  );
  check(
    "teamEmployeeWhere(admin) = whole company",
    await managedIds(teamEmployeeWhere(adminReviewer, false)).then((ids) =>
      ids.includes(memberExplicit.employee.id),
    ),
    true,
  );

  // --- 5) deactivated approver is rejected ----------------------------------
  await prisma.user.update({ where: { id: managerA.user.id }, data: { isActive: false } });
  const deactivatedReviewer = await reviewerFor(managerA.user.id);
  check("deactivated user is not a reviewer", isApprovalReviewer(deactivatedReviewer), false);
  check("deactivated user may not review", canReviewEmployee(deactivatedReviewer, targetDept), false);
  await prisma.user.update({ where: { id: managerA.user.id }, data: { isActive: true } });

  // --- 6) INACTIVE employee record is rejected ------------------------------
  await prisma.employee.update({
    where: { id: managerA.employee.id },
    data: { status: "INACTIVE" },
  });
  const inactiveReviewer = await reviewerFor(managerA.user.id);
  check("INACTIVE employee record is not a reviewer", isApprovalReviewer(inactiveReviewer), false);
  check("INACTIVE employee record may not review", canReviewEmployee(inactiveReviewer, targetDept), false);
  await prisma.employee.update({
    where: { id: managerA.employee.id },
    data: { status: "ACTIVE" },
  });

  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);

  // --- cleanup --------------------------------------------------------------
  const leftovers = await cleanFixtures();
  console.log("cleanup leftovers:", leftovers);

  await prisma.$disconnect();
  if (failed > 0 || leftovers > 0) process.exit(1);
}

/** Removes every fixture row this script (or an earlier aborted run) may have left. */
async function cleanFixtures(): Promise<number> {
  await prisma.employee.deleteMany({
    where: {
      OR: [
        { email: { endsWith: "@test.local" } },
        { department: { name: { startsWith: "QA-" } } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: "QA-" } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: "ZZ-" } } });
  return (
    (await prisma.employee.count({ where: { email: { endsWith: "@test.local" } } })) +
    (await prisma.user.count({ where: { email: { endsWith: "@test.local" } } })) +
    (await prisma.department.count({ where: { name: { startsWith: "QA-" } } })) +
    (await prisma.company.count({ where: { name: { startsWith: "ZZ-" } } }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
