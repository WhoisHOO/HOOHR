import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAnyUser } from "@/lib/bootstrap";
import { getDict } from "@/i18n/server";
import { SetupForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { setup } = await getDict();
  return { title: setup.title };
}

export default async function SetupPage() {
  // Setup is a first-run screen. Once any account exists it is off-limits.
  if (await hasAnyUser()) redirect("/login");

  const { setup } = await getDict();
  const company = await prisma.company.findFirst();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Image src="/logo.png" alt="HOOHR" width={48} height={48} className="mx-auto" priority />
          <h1 className="mt-3 text-xl font-semibold text-zinc-900">{setup.heading}</h1>
          <p className="mt-1 text-sm text-zinc-500">{setup.subtitle}</p>
        </div>
        <SetupForm defaultCompanyName={company?.name ?? ""} />
      </div>
    </div>
  );
}
