import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { BalanceImportForm } from "./import-form";

export const metadata: Metadata = {
  title: "연차 잔여 가져오기",
};

export default async function BalancesAdminPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">연차 잔여 가져오기</h1>
        <p className="mt-1 text-sm text-zinc-500">
          스프레드시트 등에서 기존 잔여를 일괄 입력합니다 (employee 기준 upsert).
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">CSV 형식</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-700">
{`email,kind,year,grantedDays,usedDays,adjustDays
mike@example.com,PTO,2026,15,2,0
soo@example.com,SICK,2026,11,0,0`}
        </pre>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          <li>· kind: PTO / SICK / UNPAID (회사에 등록된 정책만)</li>
          <li>· usedDays, adjustDays 는 생략 가능 (기본 0)</li>
          <li>· 이미 존재하는 (email, 정책, 연도)는 덮어씁니다</li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">파일 업로드</h2>
        <div className="mt-4">
          <BalanceImportForm />
        </div>
      </section>
    </div>
  );
}