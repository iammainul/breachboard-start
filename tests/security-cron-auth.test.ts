import { afterEach, describe, expect, it } from "vitest";
import { retentionCronAuthorized } from "@/lib/documents/cron-auth";

const baseEnv = {
  DATABASE_URL: "postgresql://ttx:ttx@127.0.0.1:5432/ttx",
  AUTH_SECRET: "a-sufficiently-long-unique-production-secret",
  NODE_ENV: "test",
};

afterEach(() => {
  delete process.env.RETENTION_CRON_SECRET;
  delete process.env.CRON_SECRET;
});

function requestWith(header: string, value: string) {
  return new Request("http://localhost/api/internal/retention/run", {
    headers: { [header]: value },
  });
}

describe("retentionCronAuthorized", () => {
  it("accepts Bearer and x-retention-secret when they match", () => {
    process.env.RETENTION_CRON_SECRET = "unit-test-retention-secret";
    Object.assign(process.env, baseEnv);
    expect(
      retentionCronAuthorized(requestWith("authorization", "Bearer unit-test-retention-secret")),
    ).toBe(true);
    expect(
      retentionCronAuthorized(requestWith("x-retention-secret", "unit-test-retention-secret")),
    ).toBe(true);
  });

  it("rejects wrong, empty, and missing secrets", () => {
    process.env.RETENTION_CRON_SECRET = "unit-test-retention-secret";
    Object.assign(process.env, baseEnv);
    expect(
      retentionCronAuthorized(requestWith("authorization", "Bearer other-secret")),
    ).toBe(false);
    expect(retentionCronAuthorized(requestWith("authorization", "Bearer "))).toBe(
      false,
    );
    delete process.env.RETENTION_CRON_SECRET;
    expect(
      retentionCronAuthorized(requestWith("authorization", "Bearer unit-test-retention-secret")),
    ).toBe(false);
  });
});
