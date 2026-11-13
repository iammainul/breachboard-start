import { prisma } from "@/lib/prisma";
import { seedMinimalAttack } from "@/lib/attack/seed";

seedMinimalAttack()
  .then((r) => {
    console.log("Seeded ATT&CK subset", r);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
