import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { getDict } from "@/i18n/server";

const ADMIN_NAV_ITEMS = [
  { href: "/hoohr", label: "dashboard" },
  { href: "/hoohr/leave", label: "leave" },
  { href: "/hoohr/expenses", label: "expenses" },
] as const;

// 직원의 메뉴는 딱 두 가지: 휴가 신청, 영수증 제출. 그 외(대시보드·관리
// 메뉴)는 보여주지 않는다 — 첫 사용자가 "뭐부터 하지"를 물을 일이 없게.
const EMPLOYEE_NAV_ITEMS = [
  { href: "/hoohr/leave", label: "leaveRequest" },
  { href: "/hoohr/expenses", label: "expenseSubmit" },
] as const;

export default async function AppLayout({ children }: LayoutProps<"/hoohr">) {
  const user = await requireUser();
  const { nav } = await getDict();
  const isAdmin = user.role === "ADMIN";
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : EMPLOYEE_NAV_ITEMS;

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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {nav[item.label]}
            </Link>
          ))}

          {isAdmin && (
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
