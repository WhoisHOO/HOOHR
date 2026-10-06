import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Brand rename hr-app -> HOOHR moved the app routes from /app to /hoohr.
  // Keep old bookmarks working instead of 404ing them.
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return NextResponse.redirect(
      new URL(`/hoohr${pathname.slice("/app".length)}`, request.nextUrl),
    );
  }

  const token = request.cookies.get("session")?.value;
  const session = await decrypt(token);

  const isAppRoute = pathname.startsWith("/hoohr");
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/invite") ||
    // Readiness probe used by the compose healthcheck and start.bat. It reads
    // no user data and returns only {status, database, schema} - the reach of
    // the two booleans is the point, since "up but unmigrated" is exactly the
    // state a first run has to survive. If this is ever exposed publicly,
    // consider gating it - a 200/503 split does tell an attacker whether the
    // database is answering.
    pathname === "/api/health";

  // 미로그인 → 앱 라우트 차단
  if (isAppRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // 로그인됨 → 로그인 페이지 회피
  if (pathname === "/login" && session?.userId) {
    return NextResponse.redirect(new URL("/hoohr", request.nextUrl));
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