import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildAuditEvent,
  type AuditWrite,
} from "@/lib/documents/audit-event";

export {
  AuditAppendOnlyError,
  buildAuditEvent,
  documentAuditMutations,
  type AuditWrite,
} from "@/lib/documents/audit-event";

/**
 * App-side append-only API. There is no update/delete helper on purpose.
 * Prisma query extensions in `lib/prisma.ts` also reject update/delete.
 */
export async function appendDocumentAudit(input: AuditWrite) {
  const row = buildAuditEvent(input);
  await prisma.documentAuditEvent.create({
    data: {
      action: row.action,
      organizationId: row.organizationId,
      target: row.target,
      documentId: row.documentId,
      sessionId: row.sessionId,
      actorId: row.actorId,
      reason: row.reason,
      meta: (row.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      createdAt: row.createdAt,
    },
  });
  return row;
}
