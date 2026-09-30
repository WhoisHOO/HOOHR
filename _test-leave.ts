import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
import { computeLeaveDays, countWorkdays, remainingDays } from "./src/lib/leave";
import { zonedToday } from "./src/lib/date";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com" },
    include: { employee: true },
  });
  if (!admin?.employee) throw new Error("no admin employee");
  const employeeId = admin.employee.id;
  const companyId = admin.companyId;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const tz = company?.timezone ?? "UTC";
  const today = zonedToday(tz);
  const year = today.getUTCFullYear();

  const pto = await prisma.leavePolicy.findFirst({
    where: { companyId, kind: "PTO" },
  });
  const sick = await prisma.leavePolicy.findFirst({
    where: { companyId, kind: "SICK" },
  });
  if (!pto) throw new Error("no PTO policy");
  const bal = await prisma.leaveBalance.findUnique({
    where: { employeeId_policyId_year: { employeeId, policyId: pto.id, year } },
  });
  if (!bal) throw new Error("no PTO balance");
  const baseline = bal.usedDays;
  const original = { grantedDays: bal.grantedDays, usedDays: baseline, adjustDays: bal.adjustDays };

  // 다음 평일 시작일 (월~금 범위) 계산
  let start = addDays(today, 1);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) start = addDays(start, 1);
  const end = addDays(start, 4); // Mon..Fri
  console.log("countWorkdays Mon-Fri:", countWorkdays(start, end));
  console.log("computeLeaveDays full:", computeLeaveDays(start, end, false), "half:", computeLeaveDays(start, end, true));

  // 1) 신청 생성 (status PENDING)
  const r1 = await prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      policyId: pto.id,
      startDate: start,
      endDate: end,
      isHalfDay: false,
      days: 5,
      reason: "test PTO",
    },
  });
  console.log("1) request created PENDING:", r1.status);

  // 2) 승인 → usedDays += 5
  const approve = async (id: string, decidedById: string) => {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.leaveRequest.findUnique({ where: { id } });
      if (!fresh || fresh.status !== "PENDING") return;
      const p = await tx.leavePolicy.findUnique({ where: { id: fresh.policyId } });
      if (p && p.kind !== "UNPAID") {
        const y = fresh.startDate.getUTCFullYear();
        await tx.leaveBalance.update({
          where: { employeeId_policyId_year: { employeeId: fresh.employeeId, policyId: fresh.policyId, year: y } },
          data: { usedDays: { increment: fresh.days } },
        });
      }
      await tx.leaveRequest.update({
        where: { id },
        data: { status: "APPROVED", decidedById, decidedAt: new Date() },
      });
    });
  };
  await approve(r1.id, admin.id);
  let b = await prisma.leaveBalance.findUnique({
    where: { employeeId_policyId_year: { employeeId, policyId: pto.id, year } },
  });
  console.log("2) after approve usedDays:", b?.usedDays, "expect", baseline + 5, "remaining:", remainingDays(b!));

  // 3) 중복 승인 시도 → not PENDING → skip (잔액 이중 차감 없음)
  await approve(r1.id, admin.id);
  b = await prisma.leaveBalance.findUnique({
    where: { employeeId_policyId_year: { employeeId, policyId: pto.id, year } },
  });
  console.log("3) duplicate approve usedDays:", b?.usedDays, "expect", baseline + 5);

  // 4) 반려 → 차감 없음
  const r2 = await prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      policyId: pto.id,
      startDate: addDays(start, 6),
      endDate: addDays(start, 6),
      isHalfDay: false,
      days: 1,
      reason: "test reject",
    },
  });
  await prisma.leaveRequest.update({
    where: { id: r2.id },
    data: { status: "REJECTED", decidedById: admin.id, decidedAt: new Date(), decisionComment: "중복" },
  });
  b = await prisma.leaveBalance.findUnique({
    where: { employeeId_policyId_year: { employeeId, policyId: pto.id, year } },
  });
  console.log("4) after reject usedDays:", b?.usedDays, "expect", baseline + 5);

  // 5) 취소 (PENDING만) → CANCELED
  const r3 = await prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      policyId: sick!.id,
      startDate: addDays(start, 8),
      endDate: addDays(start, 8),
      isHalfDay: true,
      halfDayDate: addDays(start, 8),
      days: 0.5,
      reason: "test cancel",
    },
  });
  await prisma.leaveRequest.update({ where: { id: r3.id }, data: { status: "CANCELED" } });
  console.log("5) canceled status:", (await prisma.leaveRequest.findUnique({ where: { id: r3.id } }))?.status);

  // 6) UNPAID 승인 시 잔액 차감 없음 (정책 없음이므로 스킵 검증: UNPAID 정책 조회)
  const unpaid = await prisma.leavePolicy.findFirst({ where: { companyId, kind: "UNPAID" } });
  console.log("6) UNPAID policy exists:", !!unpaid, "(skip deduction for UNPAID)");

  // 7) 정리
  await prisma.leaveRequest.deleteMany({ where: { id: { in: [r1.id, r2.id, r3.id] } } });
  await prisma.leaveBalance.update({
    where: { employeeId_policyId_year: { employeeId, policyId: pto.id, year } },
    data: { usedDays: original.usedDays },
  });
  console.log("7) cleanup done");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});