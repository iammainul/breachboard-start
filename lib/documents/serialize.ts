import { documentStatus, projectedExpiryLabel } from "@/lib/documents/retention";

export function serializeClientDocument(doc: {
  id: string;
  organizationId: string;
  sessionId: string | null;
  uploadedById: string | null;
  kind: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  contentSha256: string;
  retentionDays: number;
  retainUntil: Date | null;
  extractStatus: string;
  extractError: string | null;
  extractPageCount: number | null;
  extractTruncated: boolean;
  extractedText: string | null;
  softDeletedAt: Date | null;
  softDeleteReason: string | null;
  hardDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: { id: string; name: string; slug?: string };
  session?: { id: string; joinCode: string; runKind: string; status: string } | null;
  uploadedBy?: { id: string; name: string; email: string } | null;
}) {
  const status = documentStatus(doc);
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    organizationName: doc.organization?.name ?? null,
    sessionId: doc.sessionId,
    sessionJoinCode: doc.session?.joinCode ?? null,
    sessionRunKind: doc.session?.runKind ?? null,
    uploadedById: doc.uploadedById,
    uploadedByName: doc.uploadedBy?.name ?? null,
    kind: doc.kind,
    originalName: status === "hard_deleted" ? "(purged)" : doc.originalName,
    mimeType: doc.mimeType,
    byteSize: doc.byteSize,
    contentSha256: doc.contentSha256,
    retentionDays: doc.retentionDays,
    retainUntil: doc.retainUntil?.toISOString() ?? null,
    expiry: projectedExpiryLabel(doc),
    extractStatus: doc.extractStatus,
    extractError: doc.extractError,
    extractPageCount: doc.extractPageCount,
    extractTruncated: doc.extractTruncated,
    hasExtractedText: Boolean(doc.extractedText && status === "active"),
    softDeletedAt: doc.softDeletedAt?.toISOString() ?? null,
    softDeleteReason: doc.softDeleteReason,
    hardDeletedAt: doc.hardDeletedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    status,
    downloadable: status !== "hard_deleted" && Boolean(doc.storageKey),
  };
}

export function serializeAuditEvent(row: {
  id: string;
  documentId: string | null;
  organizationId: string;
  sessionId: string | null;
  actorId: string | null;
  action: string;
  reason: string | null;
  target: string;
  meta: unknown;
  createdAt: Date;
  actor?: { id: string; name: string; email: string } | null;
  organization?: { name: string } | null;
}) {
  return {
    id: row.id,
    documentId: row.documentId,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    sessionId: row.sessionId,
    actorId: row.actorId,
    actorName: row.actor?.name ?? null,
    actorEmail: row.actor?.email ?? null,
    action: row.action,
    reason: row.reason,
    target: row.target,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
  };
}
