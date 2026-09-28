import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/hoohr", label: "대시보드", ready: true },
  { href: "/hoohr/attendance", label: "근태", ready: true },
  { href: "/hoohr/leave", label: "휴가", ready: true },
  { href: "/hoohr/expenses", label: "경비", ready: true },
];

export default async function AppLayout({ children }: LayoutProps<"/hoohr">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      {/* 사이드바 */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <Link href="/hoohr" className="text-lg font-semibold text-zinc-900">
            HOOHR
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400"
              >
                {item.label}
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  준비중
                </span>
              </span>
            ),
          )}

          {user.role === "ADMIN" && (
            <>
              <div className="my-2 border-t border-zinc-200" />
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                관리자
              </p>
              <Link
                href="/hoohr/admin/employees"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                직원·조직
              </Link>
              <Link
                href="/hoohr/admin/invite"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                직원 초대
              </Link>
              <Link
                href="/hoohr/admin/balances"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                연차 잔여 가져오기
              </Link>
              <Link
                href="/hoohr/admin/settings"
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                회사 설정
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-zinc-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-zinc-900">
            {user.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 overflow-x-auto px-8 py-8">{children}</main>
    </div>
  );
}
