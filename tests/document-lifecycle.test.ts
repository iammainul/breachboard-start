import { describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/documents/extract";
import {
  closeSessionSoftDeletes,
  createLifecycleMemory,
  memoryCreateDocument,
  memoryHardDelete,
  memoryRecordExtract,
  memoryRestore,
  memorySoftDelete,
  memorySweepDue,
  memoryVisible,
} from "@/lib/documents/lifecycle-core";
import { addUtcDays, isDueForHardDelete } from "@/lib/documents/retention";

const t0 = new Date("2026-02-01T12:00:00.000Z");

function upload(
  mem: ReturnType<typeof createLifecycleMemory>,
  extra?: { sessionId?: string; now?: Date; kind?: "IRP" | "CCMP" },
) {
  return memoryCreateDocument(mem, {
    organizationId: "org_1",
    sessionId: extra?.sessionId,
    uploadedById: "admin_1",
    kind: extra?.kind ?? "IRP",
    originalName: "irp.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: new Uint8Array([1, 2, 3, 4]),
    storageKey: `orgs/org_1/plans/irp-${mem.nextId}.docx`,
    retention: { orgDays: 14 },
    now: extra?.now ?? t0,
  });
}

describe("soft-to-hard deletion", () => {
  it("hides soft-deleted docs from the visible set and restores until purge", () => {
    const mem = createLifecycleMemory();
    const doc = upload(mem);
    expect(memoryVisible(mem)).toHaveLength(1);

    memorySoftDelete(mem, doc.id, {
      actorId: "admin_1",
      reason: "engagement_closed",
      now: addUtcDays(t0, 1),
    });
    expect(memoryVisible(mem)).toHaveLength(0);
    expect(mem.blobs.has(doc.storageKey)).toBe(true);
    expect(mem.documents.get(doc.id)?.extractedText).toBeNull();

    memoryRestore(mem, doc.id, { actorId: "admin_1", now: addUtcDays(t0, 2) });
    expect(memoryVisible(mem)).toHaveLength(1);
  });

  it("hard-delete removes bytes, scrubs extract, and is idempotent", () => {
    const mem = createLifecycleMemory();
    const doc = upload(mem);
    memoryRecordExtract(mem, doc.id, {
      text: "CONFIDENTIAL IRP clause 4.2",
      status: "ok",
      error: null,
      pageCount: null,
      truncated: false,
    });
    expect(mem.documents.get(doc.id)?.extractedText).toContain("CONFIDENTIAL");

    const first = memoryHardDelete(mem, doc.id, {
      actorId: "admin_1",
      reason: "retention_sweep",
      now: addUtcDays(t0, 20),
    });
    expect(first.extractedText).toBeNull();
    expect(first.extractStatus).toBe("scrubbed");
    expect(first.storageKey).toBe("");
    expect(mem.blobs.size).toBe(0);

    const second = memoryHardDelete(mem, doc.id, {
      actorId: "admin_1",
      reason: "retention_sweep",
      now: addUtcDays(t0, 21),
    });
    expect(second.hardDeletedAt?.toISOString()).toBe(first.hardDeletedAt?.toISOString());
    expect(mem.audits.filter((a) => a.action === "HARD_DELETED")).toHaveLength(1);
  });

  it("sweep hard-deletes only after the post-close retention window", () => {
    const mem = createLifecycleMemory();
    const doc = upload(mem);
    const closedAt = addUtcDays(t0, 2);
    memorySoftDelete(mem, doc.id, {
      actorId: "mod_1",
      reason: "session_closed",
      now: closedAt,
    });

    expect(memorySweepDue(mem, addUtcDays(closedAt, 13))).toHaveLength(0);
    expect(mem.blobs.size).toBe(1);

    const purged = memorySweepDue(mem, addUtcDays(closedAt, 14));
    expect(purged).toHaveLength(1);
    expect(purged[0]?.id).toBe(doc.id);
    expect(mem.documents.get(doc.id)?.hardDeletedAt).toBeTruthy();

    expect(memorySweepDue(mem, addUtcDays(closedAt, 30))).toHaveLength(0);
  });

  it("closing an engagement soft-deletes org-level plans; draft close does not", () => {
    const mem = createLifecycleMemory();
    const standing = upload(mem, { kind: "CCMP" });
    const bound = upload(mem, { sessionId: "ses_draft", kind: "IRP" });

    closeSessionSoftDeletes(mem, {
      sessionId: "ses_draft",
      organizationId: "org_1",
      runKind: "draft",
      now: addUtcDays(t0, 1),
    });
    expect(mem.documents.get(standing.id)?.softDeletedAt).toBeNull();
    expect(mem.documents.get(bound.id)?.softDeletedAt).toBeTruthy();

    closeSessionSoftDeletes(mem, {
      sessionId: "ses_live",
      organizationId: "org_1",
      runKind: "engagement",
      now: addUtcDays(t0, 2),
    });
    expect(mem.documents.get(standing.id)?.softDeletedAt).toBeTruthy();
    expect(mem.documents.get(standing.id)?.softDeleteReason).toBe(
      "engagement_closed",
    );
  });

  it("cannot restore after hard-delete", () => {
    const mem = createLifecycleMemory();
    const doc = upload(mem);
    memoryHardDelete(mem, doc.id, { reason: "admin_hard_delete", now: t0 });
    expect(() => memoryRestore(mem, doc.id, { now: t0 })).toThrow(
      /hard-deleted/,
    );
    expect(isDueForHardDelete(mem.documents.get(doc.id)!, t0)).toBe(false);
  });
});

describe("extraction caps", () => {
  it("truncates oversized text and skips empty files", async () => {
    const huge = "PLAN ".repeat(80_000);
    const ok = await extractDocumentText({
      bytes: new TextEncoder().encode(huge),
      mimeType: "text/plain",
      filename: "plan.txt",
      maxChars: 100,
    });
    expect(ok.status).toBe("ok");
    expect(ok.truncated).toBe(true);
    expect(ok.text?.length).toBe(100);

    const empty = await extractDocumentText({
      bytes: new Uint8Array(),
      mimeType: "application/pdf",
      filename: "empty.pdf",
    });
    expect(empty.status).toBe("failed");
  });

  it("skips legacy .doc and returns failed on a thrown parser", async () => {
    const skipped = await extractDocumentText({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "application/msword",
      filename: "old.doc",
    });
    expect(skipped.status).toBe("skipped");

    const failed = await extractDocumentText(
      {
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: "application/pdf",
        filename: "broken.pdf",
      },
      {
        pdf: async () => {
          throw new Error("boom");
        },
      },
    );
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("boom");
  });

  it("caps PDF pages via the parser contract", async () => {
    const result = await extractDocumentText(
      {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "application/pdf",
        filename: "long.pdf",
        maxPages: 50,
        maxChars: 20,
      },
      {
        pdf: async (_bytes, maxPages) => ({
          text: "x".repeat(500),
          pageCount: 90,
          truncated: 90 > maxPages,
        }),
      },
    );
    expect(result.truncated).toBe(true);
    expect(result.pageCount).toBe(90);
    expect(result.text).toHaveLength(20);
  });
});
