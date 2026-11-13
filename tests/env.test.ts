import { describe, expect, test } from "vitest";
import {
  assertRuntimeEnv,
  formatEnvIssues,
  isBuildPhase,
  parseEnv,
} from "@/lib/env";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://ttx:ttx@db:5432/ttx",
  AUTH_SECRET: "a-sufficiently-long-unique-production-secret",
  AUTH_URL: "https://ttx.example.com",
  OPERATOR_EMAIL: "ops@example.com",
  OPERATOR_PASSWORD: "not-a-placeholder-password",
} as NodeJS.ProcessEnv;

describe("parseEnv", () => {
  test("accepts a complete production env", () => {
    const { env, issues } = parseEnv(valid);
    expect(issues).toEqual([]);
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.ALLOW_DEV_DEFAULTS).toBe(false);
  });

  test("rejects missing DATABASE_URL without echoing secrets", () => {
    const { issues } = parseEnv({ ...valid, DATABASE_URL: "" });
    expect(issues.some((issue) => issue.path === "DATABASE_URL")).toBe(true);
    const text = formatEnvIssues(issues);
    expect(text).toContain("DATABASE_URL");
    expect(text).not.toContain("not-a-placeholder-password");
    expect(text).not.toContain("a-sufficiently-long-unique-production-secret");
  });

  test("rejects placeholder AUTH_SECRET in strict production", () => {
    const { issues } = parseEnv({
      ...valid,
      AUTH_SECRET: "replace-with-a-long-random-string",
    });
    expect(issues.some((issue) => issue.path === "AUTH_SECRET")).toBe(true);
  });

  test("allows placeholder secrets when ALLOW_DEV_DEFAULTS is set", () => {
    const { issues } = parseEnv({
      ...valid,
      AUTH_SECRET: "replace-with-a-long-random-string",
      OPERATOR_PASSWORD: "change-me",
      ALLOW_DEV_DEFAULTS: "true",
    });
    expect(issues).toEqual([]);
  });

  test("accepts optional IRP/CCMP retention sweep vars", () => {
    const { env, issues } = parseEnv({
      ...valid,
      DOCUMENT_RETENTION_SWEEP_MS: "3600000",
      RETENTION_CRON_SECRET: "a-long-random-retention-secret",
    });
    expect(issues).toEqual([]);
    expect(env.DOCUMENT_RETENTION_SWEEP_MS).toBe("3600000");
    expect(env.RETENTION_CRON_SECRET).toBe("a-long-random-retention-secret");
  });

  test("accepts optional MEDIA_ROOT and rate-limit caps", () => {
    const { env, issues } = parseEnv({
      ...valid,
      MEDIA_ROOT: "/data/media",
      RATE_LIMIT_STORE: "memory",
      RATE_LIMIT_LOGIN_MAX: "10",
      RATE_LIMIT_JOIN_MAX: "80",
      RATE_LIMIT_JOIN_IP_MAX: "120",
      RATE_LIMIT_RETENTION_MAX: "12",
    });
    expect(issues).toEqual([]);
    expect(env.MEDIA_ROOT).toBe("/data/media");
    expect(env.RATE_LIMIT_STORE).toBe("memory");
    expect(env.RATE_LIMIT_LOGIN_MAX).toBe("10");
    expect(env.RATE_LIMIT_JOIN_MAX).toBe("80");
    expect(env.RATE_LIMIT_JOIN_IP_MAX).toBe("120");
    expect(env.RATE_LIMIT_RETENTION_MAX).toBe("12");
  });
});

describe("assertRuntimeEnv", () => {
  test("skips fail-fast during next build", () => {
    expect(
      isBuildPhase({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    ).toBe(true);
    const env = assertRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      AUTH_SECRET: "build-time-secret",
      DATABASE_URL: "postgresql://ttx:ttx@db:5432/ttx",
    });
    expect(env.AUTH_SECRET).toBe("build-time-secret");
  });

  test("does not throw in test NODE_ENV without full production secrets", () => {
    const env = assertRuntimeEnv({ NODE_ENV: "test" });
    expect(env.NODE_ENV).toBe("test");
  });
});
