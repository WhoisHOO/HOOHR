import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "./accept-form";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { getDict, interpolate } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDict();
  return { title: auth.accept.title };
}

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const { auth } = await getDict();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invitation) {
    return (
      <Shell>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {auth.accept.invalidLink}
        </p>
      </Shell>
    );
  }

  if (invitation.usedAt || invitation.expiresAt < new Date()) {
    return (
      <Shell>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {auth.accept.expiredLink}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 text-sm text-zinc-600">
        <p>
          {interpolate(auth.accept.invitedBy, {
            company: invitation.company.name,
          })}
        </p>
        <p className="text-zinc-500">{invitation.email}</p>
      </div>
      <AcceptInviteForm token={token} />
    </Shell>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const { auth } = await getDict();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            {auth.accept.heading}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{auth.accept.subtitle}</p>
        </div>
        {children}
        <div className="mt-6 flex justify-center border-t border-zinc-200 pt-4">
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
