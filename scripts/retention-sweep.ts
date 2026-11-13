import { logger, logError } from "@/lib/logger";
import { runRetentionSweep } from "@/lib/documents/sweep";

async function main() {
  const result = await runRetentionSweep({
    limit: Number(process.env.RETENTION_SWEEP_LIMIT ?? 100),
  });
  logger.info({ ok: true, ...result }, "document retention sweep finished");
}

main().catch((error) => {
  logError("document retention sweep failed", error);
  process.exit(1);
});
