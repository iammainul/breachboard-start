import { prisma } from "@/lib/prisma";
import { syncEnterpriseAttack } from "@/lib/attack/sync";

syncEnterpriseAttack()
  .then((r) => {
    console.log("Synced MITRE ATT&CK Enterprise", r);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
