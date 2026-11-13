import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertRuntimeEnv } = await import("@/lib/env");
  const { logger } = await import("@/lib/logger");
  const env = assertRuntimeEnv();
  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      strictProduction: env.NODE_ENV === "production" && !env.ALLOW_DEV_DEFAULTS,
    },
    "runtime environment validated",
  );

  const raw = env.DOCUMENT_RETENTION_SWEEP_MS;
  const ms = raw ? Number(raw) : NaN;
  if (Number.isFinite(ms) && ms >= 60_000) {
    const { startRetentionSweepLoop } = await import("@/lib/documents/sweep-loop");
    startRetentionSweepLoop(ms);
    logger.info({ intervalMs: ms }, "document retention sweep loop started");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const { logError } = await import("@/lib/logger");
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;
  logError("unhandled request error", err, {
    path: request.path.split("?")[0],
    method: request.method,
    routeType: context.routeType,
    digest,
  });
};
