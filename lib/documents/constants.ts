/** Default IRP/CCMP retention (FR-DOC-02 / BRD §4). N days after soft-delete. */
export const DEFAULT_RETENTION_DAYS = 14;
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 365;

/**
 * Active documents that are never closed still cannot live forever.
 * Hard-delete after this many days from upload if still on file.
 * Separate from the 14-day post-close clock — see docs/decisions/uploads.md.
 */
export const ABANDONED_ACTIVE_MAX_DAYS = 365;

export const EXTRACT_MAX_PAGES = 50;
export const EXTRACT_MAX_CHARS = 200_000;
export const GRADE_EXCERPT_CHARS = 4_000;
export const EXTRACT_MAX_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_KINDS = ["IRP", "CCMP", "OTHER"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const SLOT_KINDS = ["crisis", "irc"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const AUDIT_ACTIONS = [
  "UPLOADED",
  "VIEWED",
  "DOWNLOADED",
  "TEXT_EXTRACTED",
  "SOFT_DELETED",
  "RESTORED",
  "HARD_DELETED",
] as const;
export type DocumentAuditAction = (typeof AUDIT_ACTIONS)[number];

export const EXTRACT_STATUSES = [
  "pending",
  "ok",
  "failed",
  "skipped",
  "scrubbed",
] as const;
export type ExtractStatus = (typeof EXTRACT_STATUSES)[number];

export function slotToKind(slot: SlotKind): Exclude<DocumentKind, "OTHER"> {
  return slot === "crisis" ? "CCMP" : "IRP";
}

export function kindToSlot(kind: string): SlotKind | null {
  if (kind === "CCMP") return "crisis";
  if (kind === "IRP") return "irc";
  return null;
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isAuditAction(value: string): value is DocumentAuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
