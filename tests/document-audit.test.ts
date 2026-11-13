import { describe, expect, it } from "vitest";
import {
  AuditAppendOnlyError,
  buildAuditEvent,
  documentAuditMutations,
} from "@/lib/documents/audit-event";
import {
  createLifecycleMemory,
  memoryCreateDocument,
  memoryHardDelete,
  memoryRecordExtract,
  memoryRestore,
  memorySoftDelete,
} from "@/lib/documents/lifecycle-core";

const t0 = new Date("2026-03-01T00:00:00.000Z");

describe("append-only audit writes", () => {
  it("records actor, org, timestamp, target, and reason on each lifecycle event", () => {
    const mem = createLifecycleMemory();
    const doc = memoryCreateDocument(mem, {
      organizationId: "org_9",
      sessionId: "ses_9",
      uploadedById: "user_9",
      kind: "CCMP",
      originalName: "ccmp.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([9, 9, 9]),
      storageKey: "orgs/org_9/plans/ccmp.pdf",
      retention: { uploadDays: 14 },
      now: t0,
    });
    memoryRecordExtract(mem, doc.id, {
      text: "clause",
      status: "ok",
      error: null,
      pageCount: 2,
      truncated: false,
    }, t0);
    memorySoftDelete(mem, doc.id, {
      actorId: "user_9",
      reason: "engagement_closed",
      now: t0,
    });
    memoryRestore(mem, doc.id, { actorId: "user_9", reason: "need_it_back", now: t0 });
    memoryHardDelete(mem, doc.id, {
      actorId: "user_9",
      reason: "client_offboard",
      now: t0,
    });

    const actions = mem.audits.map((row) => row.action);
    expect(actions).toEqual([
      "UPLOADED",
      "TEXT_EXTRACTED",
      "SOFT_DELETED",
      "RESTORED",
      "HARD_DELETED",
    ]);
    for (const row of mem.audits) {
      expect(row.organizationId).toBe("org_9");
      expect(row.actorId).toBe("user_9");
      expect(row.documentId).toBe(doc.id);
      expect(row.createdAt.toISOString()).toBe(t0.toISOString());
      expect(row.target.length).toBeGreaterThan(0);
    }
    expect(mem.audits.find((r) => r.action === "SOFT_DELETED")?.reason).toBe(
      "engagement_closed",
    );
  });

  it("buildAuditEvent rejects unknown actions and missing org/target", () => {
    expect(() =>
      buildAuditEvent({
        action: "HACKED" as never,
        organizationId: "org",
        target: "x",
      }),
    ).toThrow(/Unknown audit action/);
    expect(() =>
      buildAuditEvent({
        action: "VIEWED",
        organizationId: "",
        target: "x",
      }),
    ).toThrow(/organizationId/);
  });

  it("forbids update and delete helpers from the app side", () => {
    expect(() => documentAuditMutations.update()).toThrow(AuditAppendOnlyError);
    expect(() => documentAuditMutations.deleteMany()).toThrow(/append-only/);
  });
});
