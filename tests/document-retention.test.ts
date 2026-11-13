import { describe, expect, it } from "vitest";
import {
  ABANDONED_ACTIVE_MAX_DAYS,
  DEFAULT_RETENTION_DAYS,
} from "@/lib/documents/constants";
import {
  addUtcDays,
  abandonedRetainUntil,
  clampRetentionDays,
  documentStatus,
  isDueForHardDelete,
  projectedExpiryLabel,
  resolveRetentionDays,
  retainUntilAfterSoftDelete,
} from "@/lib/documents/retention";

const t0 = new Date("2026-01-01T00:00:00.000Z");

describe("resolveRetentionDays", () => {
  it("defaults to 14 days from FR-DOC-02", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(14);
    expect(resolveRetentionDays({})).toBe(14);
  });

  it("prefers upload override, then session, then org", () => {
    expect(
      resolveRetentionDays({ uploadDays: 7, sessionDays: 21, orgDays: 30 }),
    ).toBe(7);
    expect(resolveRetentionDays({ sessionDays: 21, orgDays: 30 })).toBe(21);
    expect(resolveRetentionDays({ orgDays: 30 })).toBe(30);
  });

  it("clamps out-of-range values", () => {
    expect(clampRetentionDays(0)).toBe(1);
    expect(clampRetentionDays(9999)).toBe(365);
    expect(clampRetentionDays("nope")).toBe(14);
  });
});

describe("soft-delete clock", () => {
  it("hard-deletes N days after soft-delete, not from upload", () => {
    const uploaded = t0;
    const closed = addUtcDays(uploaded, 3);
    const due = retainUntilAfterSoftDelete(closed, 14);
    expect(due.toISOString()).toBe("2026-01-18T00:00:00.000Z");
    expect(
      isDueForHardDelete(
        {
          createdAt: uploaded,
          retentionDays: 14,
          softDeletedAt: closed,
          hardDeletedAt: null,
        },
        addUtcDays(closed, 13),
      ),
    ).toBe(false);
    expect(
      isDueForHardDelete(
        {
          createdAt: uploaded,
          retentionDays: 14,
          softDeletedAt: closed,
          hardDeletedAt: null,
        },
        addUtcDays(closed, 14),
      ),
    ).toBe(true);
  });

  it("does not hard-delete an active document before the abandoned cap", () => {
    expect(
      isDueForHardDelete(
        {
          createdAt: t0,
          retentionDays: 14,
          softDeletedAt: null,
          hardDeletedAt: null,
        },
        addUtcDays(t0, 14),
      ),
    ).toBe(false);
    expect(
      isDueForHardDelete(
        {
          createdAt: t0,
          retentionDays: 14,
          softDeletedAt: null,
          hardDeletedAt: null,
        },
        addUtcDays(t0, ABANDONED_ACTIVE_MAX_DAYS),
      ),
    ).toBe(true);
  });

  it("keeps already-purged documents off the due list", () => {
    expect(
      isDueForHardDelete(
        {
          createdAt: t0,
          retentionDays: 14,
          softDeletedAt: t0,
          hardDeletedAt: addUtcDays(t0, 1),
        },
        addUtcDays(t0, 30),
      ),
    ).toBe(false);
  });

  it("uses close+N even when an abandoned cap was later", () => {
    const closed = addUtcDays(t0, 5);
    const next = retainUntilAfterSoftDelete(closed, 14);
    expect(next.toISOString()).toBe(addUtcDays(closed, 14).toISOString());
  });

  it("labels active expiry as close-plus-N", () => {
    expect(
      projectedExpiryLabel({
        createdAt: t0,
        retentionDays: 14,
        softDeletedAt: null,
        hardDeletedAt: null,
      }),
    ).toBe("on_close_plus_14d");
    expect(
      documentStatus({ softDeletedAt: t0, hardDeletedAt: null }),
    ).toBe("soft_deleted");
  });

  it("abandoned retain-until is createdAt + 365d", () => {
    expect(abandonedRetainUntil(t0).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
