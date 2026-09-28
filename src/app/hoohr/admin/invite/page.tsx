import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { InviteForm } from "./invite-form";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDict();
  return { title: auth.invite.title };
}

export default async function InviteAdminPage() {
  await requireAdmin();
  const { auth } = await getDict();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-zinc-900">
        {auth.invite.heading}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{auth.invite.pageDescription}</p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <InviteForm />
      </div>
    </div>
  );
}
