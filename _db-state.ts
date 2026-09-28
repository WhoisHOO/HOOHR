import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  for (const policy of await prisma.leavePolicy.findMany({ include: { balances: true } })) {
    console.log(
      `${policy.kind} annual=${policy.annualDays} carry=${policy.maxCarryOverDays} [${policy.balances
        .map((b) => `${b.year}:granted${b.grantedDays}/used${b.usedDays}`)
        .join(" ")}]`,
    );
  }
  console.log("holidays:", await prisma.holiday.count(), "categories:", await prisma.expenseCategory.count());
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
