import { createHash } from "node:crypto";
import type { DocumentKind } from "@/lib/documents/constants";
import { buildAuditEvent, type AuditWrite } from "@/lib/documents/audit-event";
import {
  abandonedRetainUntil,
  isDueForHardDelete,
  resolveRetentionDays,
  retainUntilAfterSoftDelete,
  type RetentionSource,
} from "@/lib/documents/retention";
import { isRestorableDocument, isVisibleDocument } from "@/lib/documents/visibility";
import type { ExtractResult } from "@/lib/documents/extract";

export type StoredDocument = {
  id: string;
  organizationId: string;
  sessionId: string | null;
  uploadedById: string | null;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  contentSha256: string;
  retentionDays: number;
  retainUntil: Date | null;
  extractedText: string | null;
  extractStatus: string;
  extractError: string | null;
  extractPageCount: number | null;
  extractTruncated: boolean;
  softDeletedAt: Date | null;
  softDeleteReason: string | null;
  hardDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditRecord = ReturnType<typeof buildAuditEvent>;

export type MemoryBlobStore = {
  files: Map<string, Uint8Array>;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function applyExtract(doc: StoredDocument, extracted: ExtractResult, now = new Date()): StoredDocument {
  return {
    ...doc,
    extractedText: extracted.text,
    extractStatus: extracted.status,
    extractError: extracted.error,
    extractPageCount: extracted.pageCount,
    extractTruncated: extracted.truncated,
    updatedAt: now,
  };
}

export function applySoftDelete(
  doc: StoredDocument,
  reason: string,
  now = new Date(),
): StoredDocument {
  if (doc.hardDeletedAt) {
    throw new Error("Cannot soft-delete a hard-deleted document");
  }
  if (doc.softDeletedAt) return doc;
  return {
    ...doc,
    softDeletedAt: now,
    softDeleteReason: reason,
    retainUntil: retainUntilAfterSoftDelete(now, doc.retentionDays),
    updatedAt: now,
  };
}

export function applyRestore(doc: StoredDocument, now = new Date()): StoredDocument {
  if (doc.hardDeletedAt) {
    throw new Error("Cannot restore a hard-deleted document");
  }
  if (!doc.softDeletedAt) return doc;
  return {
    ...doc,
    softDeletedAt: null,
    softDeleteReason: null,
    retainUntil: abandonedRetainUntil(doc.createdAt),
    updatedAt: now,
  };
}

export function applyHardDelete(doc: StoredDocument, now = new Date()): StoredDocument {
  if (doc.hardDeletedAt) return doc;
  return {
    ...doc,
    hardDeletedAt: now,
    extractedText: null,
    extractStatus: "scrubbed",
    extractError: null,
    extractPageCount: null,
    extractTruncated: false,
    storageKey: "",
    retainUntil: now,
    updatedAt: now,
    softDeletedAt: doc.softDeletedAt ?? now,
    softDeleteReason: doc.softDeleteReason ?? "hard_delete",
  };
}

export type LifecycleMemory = {
  documents: Map<string, StoredDocument>;
  audits: AuditRecord[];
  blobs: Map<string, Uint8Array>;
  nextId: number;
};

export function createLifecycleMemory(): LifecycleMemory {
  return { documents: new Map(), audits: [], blobs: new Map(), nextId: 1 };
}

function audit(mem: LifecycleMemory, input: AuditWrite) {
  mem.audits.push(buildAuditEvent(input));
}

export function memoryCreateDocument(
  mem: LifecycleMemory,
  input: {
    organizationId: string;
    sessionId?: string | null;
    uploadedById?: string | null;
    kind: DocumentKind;
    originalName: string;
    mimeType: string;
    bytes: Uint8Array;
    storageKey: string;
    retention: RetentionSource;
    now?: Date;
  },
): StoredDocument {
  const now = input.now ?? new Date();
  const retentionDays = resolveRetentionDays(input.retention);
  const id = `doc_${mem.nextId++}`;
  const doc: StoredDocument = {
    id,
    organizationId: input.organizationId,
    sessionId: input.sessionId ?? null,
    uploadedById: input.uploadedById ?? null,
    kind: input.kind,
    originalName: input.originalName,
    mimeType: input.mimeType,
    byteSize: input.bytes.byteLength,
    storageKey: input.storageKey,
    contentSha256: sha256Hex(input.bytes),
    retentionDays,
    retainUntil: abandonedRetainUntil(now),
    extractedText: null,
    extractStatus: "pending",
    extractError: null,
    extractPageCount: null,
    extractTruncated: false,
    softDeletedAt: null,
    softDeleteReason: null,
    hardDeletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  mem.documents.set(id, doc);
  mem.blobs.set(input.storageKey, input.bytes);
  audit(mem, {
    action: "UPLOADED",
    organizationId: doc.organizationId,
    sessionId: doc.sessionId,
    actorId: doc.uploadedById,
    documentId: doc.id,
    target: `${doc.id}:${doc.storageKey}`,
    reason: "upload",
    meta: { kind: doc.kind, byteSize: doc.byteSize, retentionDays: doc.retentionDays },
    createdAt: now,
  });
  return doc;
}

export function memoryRecordExtract(
  mem: LifecycleMemory,
  id: string,
  extracted: ExtractResult,
  now = new Date(),
): StoredDocument {
  const current = mem.documents.get(id);
  if (!current) throw new Error("Not found");
  const next = applyExtract(current, extracted, now);
  mem.documents.set(id, next);
  audit(mem, {
    action: "TEXT_EXTRACTED",
    organizationId: next.organizationId,
    sessionId: next.sessionId,
    actorId: next.uploadedById,
    documentId: next.id,
    target: next.id,
    reason: extracted.status,
    meta: {
      status: extracted.status,
      truncated: extracted.truncated,
      pageCount: extracted.pageCount,
      error: extracted.error,
    },
    createdAt: now,
  });
  return next;
}

export function memorySoftDelete(
  mem: LifecycleMemory,
  id: string,
  input: { actorId?: string | null; reason: string; now?: Date },
): StoredDocument {
  const current = mem.documents.get(id);
  if (!current) throw new Error("Not found");
  if (current.hardDeletedAt) throw new Error("Cannot soft-delete a hard-deleted document");
  if (current.softDeletedAt) return current;
  const now = input.now ?? new Date();
  const next = applySoftDelete(current, input.reason, now);
  mem.documents.set(id, next);
  audit(mem, {
    action: "SOFT_DELETED",
    organizationId: next.organizationId,
    sessionId: next.sessionId,
    actorId: input.actorId ?? null,
    documentId: next.id,
    target: next.id,
    reason: input.reason,
    createdAt: now,
  });
  return next;
}

export function memoryRestore(
  mem: LifecycleMemory,
  id: string,
  input: { actorId?: string | null; reason?: string; now?: Date },
): StoredDocument {
  const current = mem.documents.get(id);
  if (!current) throw new Error("Not found");
  if (current.hardDeletedAt) throw new Error("Cannot restore a hard-deleted document");
  if (!current.softDeletedAt) return current;
  const now = input.now ?? new Date();
  const next = applyRestore(current, now);
  mem.documents.set(id, next);
  audit(mem, {
    action: "RESTORED",
    organizationId: next.organizationId,
    sessionId: next.sessionId,
    actorId: input.actorId ?? null,
    documentId: next.id,
    target: next.id,
    reason: input.reason ?? "admin_restore",
    createdAt: now,
  });
  return next;
}

export function memoryHardDelete(
  mem: LifecycleMemory,
  id: string,
  input: { actorId?: string | null; reason: string; now?: Date },
): StoredDocument {
  const current = mem.documents.get(id);
  if (!current) throw new Error("Not found");
  if (current.hardDeletedAt) return current;
  const now = input.now ?? new Date();
  if (current.storageKey) mem.blobs.delete(current.storageKey);
  const next = applyHardDelete(current, now);
  mem.documents.set(id, next);
  audit(mem, {
    action: "HARD_DELETED",
    organizationId: next.organizationId,
    sessionId: next.sessionId,
    actorId: input.actorId ?? null,
    documentId: next.id,
    target: current.storageKey || current.id,
    reason: input.reason,
    createdAt: now,
  });
  return next;
}

export function memorySweepDue(mem: LifecycleMemory, now = new Date()) {
  const purged: StoredDocument[] = [];
  for (const doc of mem.documents.values()) {
    if (!isDueForHardDelete(doc, now)) continue;
    purged.push(
      memoryHardDelete(mem, doc.id, { actorId: null, reason: "retention_sweep", now }),
    );
  }
  return purged;
}

export function memoryVisible(mem: LifecycleMemory): StoredDocument[] {
  return [...mem.documents.values()].filter(isVisibleDocument);
}

export function memoryRestorable(mem: LifecycleMemory): StoredDocument[] {
  return [...mem.documents.values()].filter(isRestorableDocument);
}

export function closeSessionSoftDeletes(
  mem: LifecycleMemory,
  input: {
    sessionId: string;
    organizationId: string;
    runKind: string;
    actorId?: string | null;
    now?: Date;
  },
): StoredDocument[] {
  const now = input.now ?? new Date();
  const out: StoredDocument[] = [];
  for (const doc of mem.documents.values()) {
    if (doc.organizationId !== input.organizationId) continue;
    if (doc.hardDeletedAt || doc.softDeletedAt) continue;
    const sessionBound = doc.sessionId === input.sessionId;
    const orgLevelOnEngagementClose =
      doc.sessionId == null && input.runKind === "engagement";
    if (!sessionBound && !orgLevelOnEngagementClose) continue;
    const reason = sessionBound
      ? "session_closed"
      : "engagement_closed";
    out.push(
      memorySoftDelete(mem, doc.id, { actorId: input.actorId, reason, now }),
    );
  }
  return out;
}

export { isDueForHardDelete };
