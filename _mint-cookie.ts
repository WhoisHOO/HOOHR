import "dotenv/config";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const email = process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com";
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = await new SignJWT({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    expiresAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

  console.log(token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
