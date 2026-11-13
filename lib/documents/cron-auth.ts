import { createHash, timingSafeEqual } from "node:crypto";
import { parseEnv } from "@/lib/env";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function retentionCronSecret(): string | null {
  const { env } = parseEnv();
  const secret = env?.RETENTION_CRON_SECRET || env?.CRON_SECRET || "";
  return secret.length > 0 ? secret : null;
}

/**
 * Constant-time compare of the presented token against the configured secret.
 * Digests are always 32 bytes so a length mismatch cannot short-circuit.
 */
export function retentionCronAuthorized(request: Request): boolean {
  const secret = retentionCronSecret();
  const header =
    request.headers.get("authorization") ??
    request.headers.get("x-retention-secret") ??
    "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : header.trim();
  const presented = sha256(token);
  const expected = sha256(secret ?? "");
  const match = timingSafeEqual(presented, expected);
  return Boolean(secret) && token.length > 0 && match;
}
