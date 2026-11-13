/**
 * Pluggable rate limiter. Default store is in-memory (single Node process).
 *
 * Trade-off: a Map is correct for Docker / the standalone server on one node
 * and needs no paid service. Multiple app replicas each keep their own
 * counters, so limits are per-instance. Swap `RATE_LIMIT_STORE` later
 * (postgres/redis) without changing callers — see docs/decisions/security.md.
 *
 * Join and login are separate buckets. Guest-join Auth.js callbacks must not
 * hit login (a 50-person room behind one NAT would lock the operator out).
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
};

export type RateLimitStore = {
  hit(key: string, limit: number, windowMs: number): RateLimitResult;
};

/** Production defaults: ~50 guests joining in a minute on one NAT, with retries. */
export const RATE_LIMIT_WINDOW_MS = {
  login: 15 * 60 * 1000,
  join: 2 * 60 * 1000,
  joinIp: 2 * 60 * 1000,
  invite: 10 * 60 * 1000,
  answer: 5 * 60 * 1000,
  retention: 15 * 60 * 1000,
} as const;

export const RATE_LIMIT_MAX = {
  /** Per IP + account. Brute force on one mailbox, not the whole office. */
  login: 10,
  /** Per IP + join code. One tabletop room, including double-clicks. */
  join: 80,
  /** Per IP across all codes. Bounds join-code stuffing. */
  joinIp: 120,
  invite: 8,
  answer: 30,
  retention: 12,
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMIT_MAX;

const LIMIT_ENV: Record<RateLimitBucket, string> = {
  login: "RATE_LIMIT_LOGIN_MAX",
  join: "RATE_LIMIT_JOIN_MAX",
  joinIp: "RATE_LIMIT_JOIN_IP_MAX",
  invite: "RATE_LIMIT_INVITE_MAX",
  answer: "RATE_LIMIT_ANSWER_MAX",
  retention: "RATE_LIMIT_RETENTION_MAX",
};

function envLimit(bucket: RateLimitBucket, fallback: number) {
  const raw = process.env[LIMIT_ENV[bucket]]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly attempts = new Map<string, number[]>();

  hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );
    if (recent.length >= limit) {
      this.attempts.set(key, recent);
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { ok: false, remaining: 0, retryAfterSec, limit };
    }
    recent.push(now);
    this.attempts.set(key, recent);
    if (this.attempts.size > 5_000) {
      for (const [entryKey, timestamps] of this.attempts) {
        if (!timestamps.some((timestamp) => now - timestamp < windowMs)) {
          this.attempts.delete(entryKey);
        }
      }
    }
    return {
      ok: true,
      remaining: Math.max(0, limit - recent.length),
      retryAfterSec: 0,
      limit,
    };
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export function resetRateLimitStore() {
  store = new MemoryRateLimitStore();
}

export function hitRateLimit(
  bucket: RateLimitBucket,
  subject: string,
  overrides?: { limit?: number; windowMs?: number },
): RateLimitResult {
  const limit = overrides?.limit ?? envLimit(bucket, RATE_LIMIT_MAX[bucket]);
  const windowMs = overrides?.windowMs ?? RATE_LIMIT_WINDOW_MS[bucket];
  const key = `${bucket}:${subject}`;
  return store.hit(key, limit, windowMs);
}

/** @deprecated Prefer hitRateLimit("invite", key). Kept for existing invite callers. */
export function allowInviteClaim(key: string) {
  return hitRateLimit("invite", key).ok;
}
