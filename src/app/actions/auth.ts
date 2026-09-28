"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  AcceptInviteFormSchema,
  InviteFormSchema,
  LoginFormSchema,
  ReinviteEmployeeFormSchema,
  type AcceptInviteState,
  type InviteState,
  type LoginState,
} from "@/lib/auth-validation";
import { createSession, deleteSession } from "@/lib/session";
import { requireAdmin } from "@/lib/dal";
import { fieldErrors } from "@/lib/form-utils";

// ============ 로그인 / 로그아웃 ============

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // 계정 존재 여부를 노출하지 않도록 동일 메시지
  const invalid = { message: "이메일 또는 비밀번호가 올바르지 않습니다" };

  if (!user || !user.isActive) return invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid;

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  });

  redirect("/hoohr");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

// ============ 직원 초대 (ADMIN) ============

export async function inviteEmployee(
  _state: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireAdmin();

  const parsed = InviteFormSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { email, name, role } = parsed.data;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email } });
    if (existingUser) return { kind: "existing_user" as const };

    await tx.invitation.updateMany({
      where: { companyId: admin.companyId, email, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const employee = await tx.employee.upsert({
      where: { companyId_email: { companyId: admin.companyId, email } },
      update: { name, status: "INVITED" },
      create: {
        companyId: admin.companyId,
        name,
        email,
        status: "INVITED",
      },
    });

    await tx.invitation.create({
      data: {
        companyId: admin.companyId,
        email,
        role,
        token,
        expiresAt,
      },
    });

    return { kind: "created" as const, employee };
  });

  if (result.kind === "existing_user") {
    return { message: "이미 등록된 이메일입니다" };
  }

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;
  revalidatePath("/hoohr/admin/employees");
  revalidatePath("/hoohr/admin/invite");
  return {
    inviteUrl,
    message: `${result.employee.name}(${email}) 초대 링크 생성됨 (7일 유효)`,
  };
}

export async function reinviteEmployee(
  _state: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireAdmin();
  const parsed = ReinviteEmployeeFormSchema.safeParse({
    employeeId: formData.get("employeeId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { employeeId, role } = parsed.data;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: admin.companyId, status: "INVITED" },
    select: { id: true, name: true, email: true, userId: true },
  });
  if (!employee || employee.userId) {
    return { message: "초대 대기 중인 직원만 다시 초대할 수 있습니다." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: employee.email } });
  if (existingUser) {
    return { message: "이미 등록된 이메일입니다" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.employee.findFirst({
      where: {
        id: employeeId,
        companyId: admin.companyId,
        status: "INVITED",
        userId: null,
      },
      select: { id: true, name: true, email: true, userId: true },
    });
    if (!fresh) return { kind: "unavailable" as const };

    const linkedUser = await tx.user.findUnique({ where: { email: fresh.email } });
    if (linkedUser) return { kind: "existing_user" as const };

    await tx.invitation.updateMany({
      where: { companyId: admin.companyId, email: fresh.email, usedAt: null },
      data: { expiresAt: new Date() },
    });
    await tx.invitation.create({
      data: {
        companyId: admin.companyId,
        email: fresh.email,
        role,
        token,
        expiresAt,
      },
    });
    return { kind: "created" as const, employee: fresh };
  });

  if (result.kind === "unavailable") {
    return { message: "더 이상 초대 대기 상태가 아닌 직원입니다." };
  }
  if (result.kind === "existing_user") {
    return { message: "이미 등록된 이메일입니다" };
  }

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;
  revalidatePath("/hoohr/admin/employees");
  revalidatePath("/hoohr/admin/invite");
  return {
    inviteUrl,
    message: `${result.employee.name}(${result.employee.email}) 초대 링크 생성됨 (7일 유효)`,
  };
}

// ============ 초대 수락 ============

export async function acceptInvitation(
  token: string,
  _state: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return { message: "초대 링크가 만료되었거나 이미 사용되었습니다" };
  }

  const parsed = AcceptInviteFormSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const { name, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });
  if (existingUser) {
    return { message: "이미 등록된 이메일입니다" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 트랜잭션: User 생성 + Employee 활성화 + Invitation 사용 처리
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId: invitation.companyId,
        email: invitation.email,
        name,
        passwordHash,
        role: invitation.role,
      },
    });

    const employee = await tx.employee.findFirst({
      where: { companyId: invitation.companyId, email: invitation.email },
    });
    if (employee) {
      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: created.id, name, status: "ACTIVE" },
      });
    } else {
      await tx.employee.create({
        data: {
          companyId: invitation.companyId,
          userId: created.id,
          name,
          email: invitation.email,
          status: "ACTIVE",
        },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });

    return created;
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
  });

  redirect("/hoohr");
}
