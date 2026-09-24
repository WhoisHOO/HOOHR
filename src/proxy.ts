import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session")?.value;
  const session = await decrypt(token);

  const isAppRoute = pathname.startsWith("/app");
  const isPublic =
    pathname === "/" || pathname === "/login" || pathname.startsWith("/invite");

  // 미로그인 → 앱 라우트 차단
  if (isAppRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // 로그인됨 → 로그인 페이지 회피
  if (pathname === "/login" && session?.userId) {
    return NextResponse.redirect(new URL("/app", request.nextUrl));
  }

  // 그 외 모든 라우트는 로그인 필요 (DAL verifySession이 데이터 보호)
  if (!isPublic) {
    if (!session?.userId) {
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};