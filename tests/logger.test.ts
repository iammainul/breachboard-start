import { Writable } from "node:stream";
import { describe, expect, test } from "vitest";
import { createLogger } from "@/lib/logger";

describe("logger redaction", () => {
  test("redacts secret-shaped keys and does not print their values", () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk, _enc, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });
    const log = createLogger(destination);
    log.info(
      {
        AUTH_SECRET: "super-secret-value",
        RETENTION_CRON_SECRET: "cron-secret-value",
        password: "hunter2",
        email: "player@example.com",
      },
      "probe",
    );
    const out = chunks.join("");
    expect(out).toContain("[Redacted]");
    expect(out).not.toContain("super-secret-value");
    expect(out).not.toContain("cron-secret-value");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("player@example.com");
  });
});
