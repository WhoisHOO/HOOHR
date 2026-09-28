import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { BalanceImportForm } from "./import-form";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDict();
  return { title: admin.balances.title };
}

export default async function BalancesAdminPage() {
  await requireAdmin();
  const { admin } = await getDict();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{admin.balances.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {admin.balances.subtitle}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">{admin.balances.csvFormat}</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-700">
{`email,kind,year,grantedDays,usedDays,adjustDays
mike@example.com,PTO,2026,10,2,0
soo@example.com,SICK,2026,5,0,0`}
        </pre>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          <li>· {admin.balances.csvNoteKind}</li>
          <li>· {admin.balances.csvNoteOptional}</li>
          <li>· {admin.balances.csvNoteOverwrite}</li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">{admin.balances.fileUpload}</h2>
        <div className="mt-4">
          <BalanceImportForm />
        </div>
      </section>
    </div>
  );
}