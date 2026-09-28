import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">HOOHR</h1>
          <p className="mt-1 text-sm text-zinc-500">
            근태 · 휴가 · 경비 관리에 로그인하세요
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
