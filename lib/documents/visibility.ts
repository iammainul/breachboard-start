import type { Prisma } from "@prisma/client";

/** Prisma `where` for documents that may appear in UI, APIs, and grading. */
export const activeDocumentWhere: Prisma.ClientDocumentWhereInput = {
  softDeletedAt: null,
  hardDeletedAt: null,
};

export function isVisibleDocument(doc: {
  softDeletedAt: Date | null;
  hardDeletedAt: Date | null;
}): boolean {
  return doc.softDeletedAt == null && doc.hardDeletedAt == null;
}

export function isRestorableDocument(doc: {
  softDeletedAt: Date | null;
  hardDeletedAt: Date | null;
}): boolean {
  return doc.softDeletedAt != null && doc.hardDeletedAt == null;
}

/** Admin ledger may include soft-deleted rows; hard-deleted stay for audit metadata only. */
export function adminListWhere(opts: {
  includeSoftDeleted?: boolean;
  includeHardDeleted?: boolean;
  organizationId?: string;
}): Prisma.ClientDocumentWhereInput {
  const parts: Prisma.ClientDocumentWhereInput[] = [];
  if (!opts.includeSoftDeleted) {
    parts.push({ softDeletedAt: null });
  }
  if (!opts.includeHardDeleted) {
    parts.push({ hardDeletedAt: null });
  }
  if (opts.organizationId) {
    parts.push({ organizationId: opts.organizationId });
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}
