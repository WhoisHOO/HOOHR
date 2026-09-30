import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Unauthenticated readiness probe. `start.bat` polls this to know when the
 * app is genuinely usable, and the compose healthcheck uses it to order
 * dependent work. It must never require a session and must never redirect.
 *
 * It answers a question a bare TCP check cannot: is the *schema* there? A
 * container that is up but has had no migrations applied serves 500 on every
 * page, which is exactly the failure mode an unattended first run has to
 * survive, so the schema probe is the whole point of this route.
 */
export async function GET() {
  const report = (checks: Record<string, string>, status: number) =>
    Response.json({ status: status === 200 ? "ok" : "error", ...checks }, { status });

  let db: string;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    return report({ database: "unreachable" }, 503);
  }

  // Probing a model the schema does not have yet throws, which is the signal
  // we want: reachable database, missing migrations.
  let schema: string;
  try {
    await prisma.user.count();
    schema = "up";
  } catch {
    return report({ database: db, schema: "missing" }, 503);
  }

  return report({ database: db, schema }, 200);
}
