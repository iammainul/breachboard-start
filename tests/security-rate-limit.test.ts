import { afterEach, describe, expect, it } from "vitest";
import {
  hitRateLimit,
  RATE_LIMIT_MAX,
  resetRateLimitStore,
} from "@/lib/security/rate-limit";

afterEach(() => {
  resetRateLimitStore();
});

describe("hitRateLimit", () => {
  it("allows traffic under the login cap and then 429s", () => {
    for (let i = 0; i < RATE_LIMIT_MAX.login; i += 1) {
      expect(hitRateLimit("login", "1.1.1.1:operator@local").ok).toBe(true);
    }
    const blocked = hitRateLimit("login", "1.1.1.1:operator@local");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates join, invite, and answer buckets", () => {
    expect(hitRateLimit("join", "ip:DEMO01").ok).toBe(true);
    expect(hitRateLimit("invite", "ip").ok).toBe(true);
    expect(hitRateLimit("answer", "ip").ok).toBe(true);
  });

  it("caps retention HTTP triggers separately", () => {
    for (let i = 0; i < RATE_LIMIT_MAX.retention; i += 1) {
      expect(hitRateLimit("retention", "cron").ok).toBe(true);
    }
    expect(hitRateLimit("retention", "cron").ok).toBe(false);
  });

  it("does not let a NAT join burst lock credential login", () => {
    const ip = "203.0.113.50";
    for (let i = 0; i < 50; i += 1) {
      expect(hitRateLimit("join", `${ip}:DEMO01`).ok, `join ${i}`).toBe(true);
      expect(hitRateLimit("joinIp", ip).ok, `joinIp ${i}`).toBe(true);
    }
    expect(hitRateLimit("login", `${ip}:operator@local`).ok).toBe(true);
    expect(hitRateLimit("login", `${ip}:priya@demo.local`).ok).toBe(true);
  });

  it("keys login per account on a shared IP", () => {
    const ip = "203.0.113.50";
    for (let i = 0; i < RATE_LIMIT_MAX.login; i += 1) {
      expect(hitRateLimit("login", `${ip}:alice@demo.local`).ok).toBe(true);
    }
    expect(hitRateLimit("login", `${ip}:alice@demo.local`).ok).toBe(false);
    expect(hitRateLimit("login", `${ip}:bob@demo.local`).ok).toBe(true);
  });

  it("keys join per session code and still bounds stuffing per IP", () => {
    const ip = "203.0.113.50";
    for (let i = 0; i < RATE_LIMIT_MAX.join; i += 1) {
      expect(hitRateLimit("join", `${ip}:DEMO01`).ok).toBe(true);
    }
    expect(hitRateLimit("join", `${ip}:DEMO01`).ok).toBe(false);
    expect(hitRateLimit("join", `${ip}:OTHER1`).ok).toBe(true);

    for (let i = 0; i < RATE_LIMIT_MAX.joinIp; i += 1) {
      expect(hitRateLimit("joinIp", ip).ok).toBe(true);
    }
    expect(hitRateLimit("joinIp", ip).ok).toBe(false);
  });
});
