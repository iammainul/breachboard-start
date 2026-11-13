import {
  AUDIT_ACTIONS,
  type DocumentAuditAction,
} from "@/lib/documents/constants";

export class AuditAppendOnlyError extends Error {
  constructor(method = "mutate") {
    super(`DocumentAuditEvent is append-only (${method} is forbidden)`);
    this.name = "AuditAppendOnlyError";
  }
}

export type AuditWrite = {
  action: DocumentAuditAction;
  organizationId: string;
  target: string;
  documentId?: string | null;
  sessionId?: string | null;
  actorId?: string | null;
  reason?: string | null;
  meta?: unknown;
  createdAt?: Date;
};

/** Shape persisted on create — used by unit tests without Prisma. */
export function buildAuditEvent(input: AuditWrite) {
  if (!(AUDIT_ACTIONS as readonly string[]).includes(input.action)) {
    throw new Error(`Unknown audit action: ${input.action}`);
  }
  if (!input.organizationId) {
    throw new Error("organizationId is required");
  }
  if (!input.target) {
    throw new Error("target is required");
  }
  return {
    action: input.action,
    organizationId: input.organizationId,
    target: input.target,
    documentId: input.documentId ?? null,
    sessionId: input.sessionId ?? null,
    actorId: input.actorId ?? null,
    reason: input.reason ?? null,
    meta: input.meta ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}

/** Forbidden mutators — tests lock the append-only contract. */
export const documentAuditMutations = {
  update(): never {
    throw new AuditAppendOnlyError("update");
  },
  updateMany(): never {
    throw new AuditAppendOnlyError("updateMany");
  },
  delete(): never {
    throw new AuditAppendOnlyError("delete");
  },
  deleteMany(): never {
    throw new AuditAppendOnlyError("deleteMany");
  },
};
