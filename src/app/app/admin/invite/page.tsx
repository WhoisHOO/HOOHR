import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = {
  title: "직원 초대",
};

export default async function InviteAdminPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-zinc-900">직원 초대</h1>
      <p className="mt-1 text-sm text-zinc-500">
        이름과 이메일로 초대 링크를 생성합니다. 링크는 7일간 유효하며, 수락 시
        계정이 생성됩니다.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <InviteForm />
      </div>
    </div>
  );
}
