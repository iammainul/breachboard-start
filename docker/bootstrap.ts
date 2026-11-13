/**
 * Docker entry bootstrap: apply migrations + seed only when empty.
 * Compiled to docker/bootstrap.cjs at image build time.
 */
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { BASELINE_MIGRATION } from "../lib/env";

const prisma = new PrismaClient();

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), msg, ...extra }));
}

function logError(msg: string, extra?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), msg, ...extra }));
}

function run(label: string, command: string, args: string[]) {
  log(label);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCaptured(args: string[]) {
  const result = spawnSync("node", args, { env: process.env, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function main() {
  const prismaCli = existsSync("./node_modules/prisma/build/index.js")
    ? "./node_modules/prisma/build/index.js"
    : null;
  if (!prismaCli) {
    logError("Prisma CLI not found in image");
    process.exit(1);
  }

  const migrateArgs = [prismaCli, "migrate", "deploy", "--schema=./prisma/schema.prisma"];
  let migrate = runCaptured(migrateArgs);
  if (migrate.status !== 0) {
    const output = `${migrate.stdout ?? ""}\n${migrate.stderr ?? ""}`;
    if (envFlag("BASELINE_DB_PUSH") && output.includes("P3005")) {
      log("Baselining db-push database", { migration: BASELINE_MIGRATION });
      const resolve = runCaptured([
        prismaCli,
        "migrate",
        "resolve",
        "--applied",
        BASELINE_MIGRATION,
        "--schema=./prisma/schema.prisma",
      ]);
      if (resolve.status !== 0) process.exit(resolve.status ?? 1);
      migrate = runCaptured(migrateArgs);
    }
  }
  if (migrate.status !== 0) {
    logError("prisma migrate deploy failed", {
      hint: `If this database was created with prisma db push, re-run deploy with BASELINE_DB_PUSH=true or: prisma migrate resolve --applied ${BASELINE_MIGRATION} && prisma migrate deploy`,
    });
    process.exit(migrate.status ?? 1);
  }

  const [tacticCount, templateCount] = await Promise.all([
    prisma.attackTactic.count(),
    prisma.exercise.count({ where: { isTemplate: true } }),
  ]);

  if (tacticCount === 0) {
    run("Seeding ATT&CK subset...", "node", ["./docker/seed.cjs"]);
  } else {
    log("Skipping ATT&CK seed", { tacticCount });
  }

  if (templateCount === 0) {
    run("Seeding scenario library...", "node", ["./docker/library-seed.cjs"]);
  } else {
    log("Skipping library seed", { templateCount });
  }

  if (envFlag("SEED_DEMO")) {
    run("Seeding demo org...", "node", ["./docker/demo-seed.cjs"]);
  } else {
    log("Skipping demo org seed (set SEED_DEMO=true to enable)");
  }
}

main()
  .catch((error) => {
    logError("bootstrap failed", {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
