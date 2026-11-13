/**
 * Fresh-app demo seed.
 *
 * Ensures ATT&CK + library templates exist, creates the operator account from
 * env, then reseeds the fictional Northline Bank demo org / pack / seated session.
 *
 *   npx tsx scripts/reseed-demo.ts
 *   ./run.sh clean
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();
const serverOnlyShim = path.resolve("scripts/shim-server-only.cjs");

function run(label: string, command: string, args: string[]) {
  console.log(`\n▸ ${label}`);
  const nodeOptions = [process.env.NODE_OPTIONS, `--require ${serverOnlyShim}`]
    .filter(Boolean)
    .join(" ");
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function ensureOperator() {
  const email =
    process.env.OPERATOR_EMAIL?.trim().toLowerCase() || "operator@local";
  const password = process.env.OPERATOR_PASSWORD || "change-me";
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Operator",
      passwordHash,
      platformRole: "ADMIN",
      canFacilitate: true,
    },
    update: {
      passwordHash,
      platformRole: "ADMIN",
      canFacilitate: true,
    },
  });
  return { email, password, id: user.id };
}

async function main() {
  const [tacticCount, templateCount] = await Promise.all([
    prisma.attackTactic.count(),
    prisma.exercise.count({ where: { isTemplate: true } }),
  ]);

  if (tacticCount === 0) {
    run("Seeding ATT&CK subset…", "npx", ["tsx", "scripts/seed-attack-min.ts"]);
  } else {
    console.log(`ATT&CK already present (${tacticCount} tactics).`);
  }

  if (templateCount === 0) {
    run("Seeding scenario library…", "npx", ["tsx", "scripts/seed-library.ts"]);
  } else {
    console.log(`Library already present (${templateCount} templates).`);
  }

  const operator = await ensureOperator();
  run("Seeding demo org…", "npx", ["tsx", "scripts/seed-demo.ts"]);

  console.log(`
Demo ready.
  Operator  ${operator.email} / ${operator.password}
  Players   priya@demo.local … ravi@demo.local / Demo@Tabletop1
  Join code DEMO01
  Session   /sessions (open the DEMO01 engagement)
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
