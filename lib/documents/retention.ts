import {
  ABANDONED_ACTIVE_MAX_DAYS,
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "@/lib/documents/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionSource = {
  /** Explicit days on this upload (FR-DOC-02). */
  uploadDays?: number | null;
  /** ExerciseSession.documentRetentionDays */
  sessionDays?: number | null;
  /** Organization.documentRetentionDays */
  orgDays?: number | null;
};

export type RetentionClock = {
  createdAt: Date;
  retentionDays: number;
  softDeletedAt: Date | null;
  hardDeletedAt: Date | null;
  retainUntil?: Date | null;
};

export function clampRetentionDays(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.round(n)));
}

/**
 * Upload override, then session, then org, then the 14-day product default.
 */
export function resolveRetentionDays(source: RetentionSource = {}): number {
  if (source.uploadDays != null) return clampRetentionDays(source.uploadDays);
  if (source.sessionDays != null) return clampRetentionDays(source.sessionDays);
  if (source.orgDays != null) return clampRetentionDays(source.orgDays);
  return DEFAULT_RETENTION_DAYS;
}

export function addUtcDays(start: Date, days: number): Date {
  return new Date(start.getTime() + clampRetentionDays(days) * DAY_MS);
}

/**
 * FR-DOC-04: N days after soft-delete. The abandoned-active cap no longer
 * applies once the file is hidden — the restore window is always N days.
 */
export function retainUntilAfterSoftDelete(
  softDeletedAt: Date,
  retentionDays: number,
): Date {
  return addUtcDays(softDeletedAt, retentionDays);
}

export function abandonedRetainUntil(createdAt: Date): Date {
  return addUtcDays(createdAt, ABANDONED_ACTIVE_MAX_DAYS);
}

/**
 * When the bytes must go. Soft-deleted docs use the post-close clock;
 * never-closed docs use the abandoned-active cap so plans cannot linger forever.
 */
export function hardDeleteDueAt(doc: RetentionClock): Date | null {
  if (doc.hardDeletedAt) return null;
  if (doc.softDeletedAt) {
    return retainUntilAfterSoftDelete(doc.softDeletedAt, doc.retentionDays);
  }
  return abandonedRetainUntil(doc.createdAt);
}

export function isDueForHardDelete(doc: RetentionClock, now = new Date()): boolean {
  if (doc.hardDeletedAt) return false;
  if (doc.softDeletedAt) {
    const due = retainUntilAfterSoftDelete(doc.softDeletedAt, doc.retentionDays);
    return now.getTime() >= due.getTime();
  }
  return now.getTime() >= abandonedRetainUntil(doc.createdAt).getTime();
}

export function projectedExpiryLabel(doc: RetentionClock): string {
  if (doc.hardDeletedAt) return "purged";
  if (doc.softDeletedAt) {
    return retainUntilAfterSoftDelete(
      doc.softDeletedAt,
      doc.retentionDays,
    ).toISOString();
  }
  return `on_close_plus_${doc.retentionDays}d`;
}

export function documentStatus(doc: {
  hardDeletedAt: Date | null;
  softDeletedAt: Date | null;
}): "active" | "soft_deleted" | "hard_deleted" {
  if (doc.hardDeletedAt) return "hard_deleted";
  if (doc.softDeletedAt) return "soft_deleted";
  return "active";
}
