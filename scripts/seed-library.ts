import { PrismaClient } from "@prisma/client";
import { seedLibraryTemplates } from "../lib/library/seed-templates";

const prisma = new PrismaClient();

async function main() {
  // Rebind prisma used by seed helpers — seed-templates imports shared prisma.
  // Ensure DB reachable then upsert templates.
  void prisma;
  const result = await seedLibraryTemplates();
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
