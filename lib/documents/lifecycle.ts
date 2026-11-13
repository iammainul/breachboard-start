import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { appendDocumentAudit } from "@/lib/documents/audit";
import type { DocumentKind } from "@/lib/documents/constants";
import { slotToKind, type SlotKind } from "@/lib/documents/constants";
import { extractDocumentText, type ExtractResult } from "@/lib/documents/extract";
import { sha256Hex } from "@/lib/documents/lifecycle-core";
import { syncOrgPlanPointers } from "@/lib/documents/org-pointers";
import {
  abandonedRetainUntil,
  resolveRetentionDays,
  retainUntilAfterSoftDelete,
  type RetentionSource,
} from "@/lib/documents/retention";
import { activeDocumentWhere } from "@/lib/documents/visibility";
import { deleteMediaFile, writeMediaFile } from "@/lib/media/fs";
import { safeMediaRel } from "@/lib/media/paths";
import { validateUpload } from "@/lib/security/upload";

export type PersistUploadInput = {
  organizationId: string;
  sessionId?: string | null;
  uploadedById?: string | null;
  slot?: SlotKind;
  kind?: DocumentKind;
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
  ext: string;
  retention: RetentionSource;
  replaceSameKind?: boolean;
};

function storageDir(organizationId: string, sessionId?: string | null) {
  return sessionId
    ? `orgs/${organizationId}/plans/${sessionId}`
    : `orgs/${organizationId}/plans`;
}

export async function persistClientDocument(input: PersistUploadInput) {
  const kind = input.kind ?? (input.slot ? slotToKind(input.slot) : "OTHER");
  const checked = validateUpload({
    kind: "org-doc",
    filename: input.originalName,
    declaredMime: input.mimeType,
    bytes: input.bytes,
    size: input.bytes.byteLength,
  });
  if ("error" in checked) {
    throw new Error(checked.error);
  }
  const now = new Date();
  const retentionDays = resolveRetentionDays(input.retention);
  const fileName = `${kind.toLowerCase()}-${randomBytes(8).toString("hex")}.${checked.ext}`;
  const relDir = storageDir(input.organizationId, input.sessionId);
  const publicPath = await writeMediaFile(relDir, fileName, input.bytes);
  const storageKey = safeMediaRel(publicPath);
  if (!storageKey) {
    throw new Error("Failed to store document");
  }

  if (input.replaceSameKind && (kind === "IRP" || kind === "CCMP")) {
    const previous = await prisma.clientDocument.findMany({
      where: {
        organizationId: input.organizationId,
        sessionId: input.sessionId ?? null,
        kind,
        ...activeDocumentWhere,
      },
      select: { id: true },
    });
    for (const row of previous) {
      await softDeleteClientDocument({
        id: row.id,
        actorId: input.uploadedById ?? null,
        reason: "replaced",
      });
    }
  }

  const created = await prisma.clientDocument.create({
    data: {
      organizationId: input.organizationId,
      sessionId: input.sessionId ?? null,
      uploadedById: input.uploadedById ?? null,
      kind,
      originalName: checked.displayName.slice(0, 180),
      mimeType: checked.mime || "application/octet-stream",
      byteSize: input.bytes.byteLength,
      storageKey,
      contentSha256: sha256Hex(input.bytes),
      retentionDays,
      retainUntil: abandonedRetainUntil(now),
      extractStatus: "pending",
      createdAt: now,
    },
  });

  await appendDocumentAudit({
    action: "UPLOADED",
    organizationId: created.organizationId,
    sessionId: created.sessionId,
    actorId: created.uploadedById,
    documentId: created.id,
    target: `${created.id}:${created.storageKey}`,
    reason: "upload",
    meta: {
      kind: created.kind,
      byteSize: created.byteSize,
      retentionDays: created.retentionDays,
      originalName: created.originalName,
    },
  });

  const extracted = await extractDocumentText({
    bytes: input.bytes,
    mimeType: created.mimeType,
    filename: created.originalName,
  });
  const withText = await recordExtraction(created.id, extracted, created.uploadedById);
  await syncOrgPlanPointers(created.organizationId);
  return withText;
}

async function recordExtraction(
  id: string,
  extracted: ExtractResult,
  actorId: string | null | undefined,
) {
  const updated = await prisma.clientDocument.update({
    where: { id },
    data: {
      extractedText: extracted.text,
      extractStatus: extracted.status,
      extractError: extracted.error,
      extractPageCount: extracted.pageCount,
      extractTruncated: extracted.truncated,
    },
  });
  await appendDocumentAudit({
    action: "TEXT_EXTRACTED",
    organizationId: updated.organizationId,
    sessionId: updated.sessionId,
    actorId: actorId ?? null,
    documentId: updated.id,
    target: updated.id,
    reason: extracted.status,
    meta: {
      status: extracted.status,
      truncated: extracted.truncated,
      pageCount: extracted.pageCount,
      error: extracted.error,
    },
  });
  return updated;
}

export async function softDeleteClientDocument(input: {
  id: string;
  actorId?: string | null;
  reason: string;
  now?: Date;
}) {
  const existing = await prisma.clientDocument.findUnique({ where: { id: input.id } });
  if (!existing) return null;
  if (existing.hardDeletedAt) {
    return existing;
  }
  if (existing.softDeletedAt) return existing;
  const now = input.now ?? new Date();
  const updated = await prisma.clientDocument.update({
    where: { id: existing.id },
    data: {
      softDeletedAt: now,
      softDeleteReason: input.reason,
      retainUntil: retainUntilAfterSoftDelete(now, existing.retentionDays),
    },
  });
  await appendDocumentAudit({
    action: "SOFT_DELETED",
    organizationId: updated.organizationId,
    sessionId: updated.sessionId,
    actorId: input.actorId ?? null,
    documentId: updated.id,
    target: updated.id,
    reason: input.reason,
  });
  await syncOrgPlanPointers(updated.organizationId);
  return updated;
}

export async function restoreClientDocument(input: {
  id: string;
  actorId?: string | null;
  reason?: string;
}) {
  const existing = await prisma.clientDocument.findUnique({ where: { id: input.id } });
  if (!existing) return null;
  if (existing.hardDeletedAt) {
    throw new Error("Cannot restore a hard-deleted document");
  }
  if (!existing.softDeletedAt) return existing;

  if (existing.kind === "IRP" || existing.kind === "CCMP") {
    const clash = await prisma.clientDocument.findFirst({
      where: {
        organizationId: existing.organizationId,
        sessionId: existing.sessionId,
        kind: existing.kind,
        id: { not: existing.id },
        ...activeDocumentWhere,
      },
      select: { id: true },
    });
    if (clash) {
      await softDeleteClientDocument({
        id: clash.id,
        actorId: input.actorId ?? null,
        reason: "replaced_on_restore",
      });
    }
  }

  const updated = await prisma.clientDocument.update({
    where: { id: existing.id },
    data: {
      softDeletedAt: null,
      softDeleteReason: null,
      retainUntil: abandonedRetainUntil(existing.createdAt),
    },
  });
  await appendDocumentAudit({
    action: "RESTORED",
    organizationId: updated.organizationId,
    sessionId: updated.sessionId,
    actorId: input.actorId ?? null,
    documentId: updated.id,
    target: updated.id,
    reason: input.reason ?? "admin_restore",
  });
  await syncOrgPlanPointers(updated.organizationId);
  return updated;
}

export async function hardDeleteClientDocument(input: {
  id: string;
  actorId?: string | null;
  reason: string;
  now?: Date;
}) {
  const existing = await prisma.clientDocument.findUnique({ where: { id: input.id } });
  if (!existing) return null;
  if (existing.hardDeletedAt) return existing;
  const now = input.now ?? new Date();
  const storageKey = existing.storageKey;
  if (storageKey) {
    await deleteMediaFile(storageKey);
  }
  const updated = await prisma.clientDocument.update({
    where: { id: existing.id },
    data: {
      hardDeletedAt: now,
      extractedText: null,
      extractStatus: "scrubbed",
      extractError: null,
      extractPageCount: null,
      extractTruncated: false,
      storageKey: "",
      retainUntil: now,
      softDeletedAt: existing.softDeletedAt ?? now,
      softDeleteReason: existing.softDeleteReason ?? input.reason,
    },
  });
  await appendDocumentAudit({
    action: "HARD_DELETED",
    organizationId: updated.organizationId,
    sessionId: updated.sessionId,
    actorId: input.actorId ?? null,
    documentId: updated.id,
    target: storageKey || updated.id,
    reason: input.reason,
  });
  await syncOrgPlanPointers(updated.organizationId);
  return updated;
}

export async function softDeleteForClosedSession(input: {
  sessionId: string;
  organizationId: string;
  runKind: string;
  actorId?: string | null;
}) {
  const sessionBound = await prisma.clientDocument.findMany({
    where: {
      sessionId: input.sessionId,
      ...activeDocumentWhere,
    },
    select: { id: true },
  });
  const orgLevel =
    input.runKind === "engagement"
      ? await prisma.clientDocument.findMany({
          where: {
            organizationId: input.organizationId,
            sessionId: null,
            ...activeDocumentWhere,
          },
          select: { id: true },
        })
      : [];

  const ids = [...new Set([...sessionBound, ...orgLevel].map((row) => row.id))];
  const reasonFor = new Map<string, string>();
  for (const row of sessionBound) reasonFor.set(row.id, "session_closed");
  for (const row of orgLevel) reasonFor.set(row.id, "engagement_closed");

  const updated = [];
  for (const id of ids) {
    updated.push(
      await softDeleteClientDocument({
        id,
        actorId: input.actorId ?? null,
        reason: reasonFor.get(id) ?? "session_closed",
      }),
    );
  }
  return updated;
}

export function extFromFilename(name: string) {
  return path.extname(name).replace(".", "").toLowerCase();
}
