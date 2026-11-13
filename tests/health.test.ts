import { describe, expect, test } from "vitest";
import { livenessBody, pingDatabase, readinessBody } from "@/lib/health";

describe("health payloads", () => {
  test("liveness has no internals", () => {
    const body = livenessBody();
    expect(body).toEqual({ status: "ok", live: true });
    expect(JSON.stringify(body)).not.toMatch(/postgres|prisma|secret|stack/i);
  });

  test("readiness reports unready without an error field", () => {
    const body = readinessBody(false);
    expect(body).toEqual({ status: "unready", live: true, ready: false });
    expect("error" in body).toBe(false);
    expect("message" in body).toBe(false);
  });
});

describe("pingDatabase", () => {
  test("returns true when ping resolves", async () => {
    await expect(pingDatabase(async () => 1)).resolves.toBe(true);
  });

  test("returns false when ping throws and does not rethrow", async () => {
    await expect(
      pingDatabase(async () => {
        throw new Error("postgresql://ttx:secret@db/ttx");
      }),
    ).resolves.toBe(false);
  });
});
