import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { getDict } from "@/i18n/server";

const NAV_ITEMS = [
  { href: "/hoohr", label: "dashboard" },
  { href: "/hoohr/leave", label: "leave" },
  { href: "/hoohr/expenses", label: "expenses" },
] as const;

export default async function AppLayout({ children }: LayoutProps<"/hoohr">) {
  const user = await requireUser();
  const { nav } = await getDict();

  return (
    <div className="flex min-h-screen">
      {/* 사이드바 */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <Link href="/hoohr" className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <Image src="/logo.png" alt="HOOHR" width={28} height={28} priority />
            HOOHR
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {nav[item.label]}
            </Link>
          ))}

          {user.role === "ADMIN" && (
            <>
              <div className="my-2 border-t border-zinc-200" />
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {nav.adminSection}
              </p>
              <Link
                href="/hoohr/admin/employees"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {nav.employees}
              </Link>
              <Link
                href="/hoohr/admin/invite"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {nav.invite}
              </Link>
              <Link
                href="/hoohr/admin/balances"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {nav.balances}
              </Link>
              <Link
                href="/hoohr/admin/settings"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {nav.settings}
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-zinc-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-zinc-900">
            {user.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
          <div className="mt-2">
            <form action={logout}>
              <button
                type="submit"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {nav.logout}
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 overflow-x-auto px-8 py-8">{children}</main>
    </div>
  );
}
