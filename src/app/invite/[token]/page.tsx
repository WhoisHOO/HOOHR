import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = {
  title: "초대 수락",
};

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invitation) {
    return (
      <Shell>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          유효하지 않은 초대 링크입니다. 관리자에게 새 링크를 요청하세요.
        </p>
      </Shell>
    );
  }

  if (invitation.usedAt || invitation.expiresAt < new Date()) {
    return (
      <Shell>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 링크를
          요청하세요.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 text-sm text-zinc-600">
        <p>
          <span className="font-medium">{invitation.company.name}</span>에서
          초대했습니다
        </p>
        <p className="text-zinc-500">{invitation.email}</p>
      </div>
      <AcceptInviteForm token={token} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">HOOHR 가입</h1>
          <p className="mt-1 text-sm text-zinc-500">
            이름과 비밀번호를 설정하면 바로 시작할 수 있어요
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
