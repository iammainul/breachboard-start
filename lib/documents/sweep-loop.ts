import { logger, logError } from "@/lib/logger";

const g = globalThis as unknown as { __breachboardRetentionSweep?: NodeJS.Timeout };

/** In-app interval for Docker/single-node. No paid scheduler. */
export function startRetentionSweepLoop(intervalMs: number) {
  if (!Number.isFinite(intervalMs) || intervalMs < 60_000) return;
  if (g.__breachboardRetentionSweep) return;
  const tick = () => {
    void import("@/lib/documents/sweep")
      .then(({ runRetentionSweep }) => runRetentionSweep())
      .then((result) => {
        logger.info(result, "document retention sweep finished");
      })
      .catch((error) => {
        logError("document retention sweep failed", error);
      });
  };
  g.__breachboardRetentionSweep = setInterval(tick, intervalMs);
  g.__breachboardRetentionSweep.unref?.();
  // First pass after boot, not immediately, so migrations can finish.
  setTimeout(tick, Math.min(intervalMs, 30_000)).unref?.();
}
