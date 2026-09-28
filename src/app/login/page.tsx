import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getDict();
  return { title: auth.login.title };
}

export default async function LoginPage() {
  const { auth } = await getDict();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">HOOHR</h1>
          <p className="mt-1 text-sm text-zinc-500">{auth.login.subtitle}</p>
        </div>
        <LoginForm />
        <div className="mt-6 flex justify-center border-t border-zinc-200 pt-4">
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
