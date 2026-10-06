import "server-only";
import { prisma } from "@/lib/prisma";

/** Is the product still in its untouched first-run state? */
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}
