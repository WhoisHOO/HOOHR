import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/session";
import { hasAnyUser } from "@/lib/bootstrap";

export type SessionUser = {
  id: string;
  companyId: string;
  role: string;
  isActive: boolean;
  name: string;
  email: string;
  employeeId: string | null;
  employeeCompanyId: string | null;
  employeeStatus: string | null;
};

/** 쿠키 세션 검증 (무효 시 null). 모든 데이터 요청의 단일 진입점. */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  return decrypt(token);
});

/** 인증된 세션 보장 (미로그인 시 /login으로 리다이렉트, 계정이 없으면 /setup으로). */
export async function verifySession() {
  if (!(await hasAnyUser())) redirect("/setup");
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
}

/** 로그인 사용자 정보 조회 (DB 검증 포함). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      companyId: true,
      role: true,
      isActive: true,
      name: true,
      email: true,
      employee: {
        select: { id: true, companyId: true, status: true },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const activeEmployee =
    user.employee &&
    user.employee.companyId === user.companyId &&
    user.employee.status === "ACTIVE"
      ? user.employee
      : null;

  return {
    id: user.id,
    companyId: user.companyId,
    role: user.role,
    isActive: user.isActive,
    name: user.name,
    email: user.email,
    employeeId: activeEmployee?.id ?? null,
    employeeCompanyId: activeEmployee?.companyId ?? null,
    employeeStatus: activeEmployee?.status ?? null,
  };
});

/** 인증 + 사용자 정보 보장 (미로그인 시 /login으로 리다이렉트). */
export async function requireUser(): Promise<SessionUser> {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** ADMIN 전용 (비관리자 시 /hoohr으로 리다이렉트). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/hoohr");
  return user;
}
