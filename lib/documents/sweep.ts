import { prisma } from "@/lib/prisma";
import { isDueForHardDelete } from "@/lib/documents/retention";
import { hardDeleteClientDocument } from "@/lib/documents/lifecycle";

export type SweepResult = {
  scanned: number;
  purged: number;
  skipped: number;
  ids: string[];
};

/**
 * Idempotent hard-delete: already-purged rows are skipped; due rows
 * lose bytes + extracted text. Safe to run concurrently — the second
 * pass sees hardDeletedAt and no-ops.
 */
export async function runRetentionSweep(opts?: {
  now?: Date;
  limit?: number;
}): Promise<SweepResult> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 100;
  const candidates = await prisma.clientDocument.findMany({
    where: { hardDeletedAt: null },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(500, limit)),
    select: {
      id: true,
      createdAt: true,
      retentionDays: true,
      retainUntil: true,
      softDeletedAt: true,
      hardDeletedAt: true,
    },
  });

  const due = candidates.filter((row) => isDueForHardDelete(row, now));
  const ids: string[] = [];
  for (const row of due) {
    const purged = await hardDeleteClientDocument({
      id: row.id,
      actorId: null,
      reason: "retention_sweep",
      now,
    });
    if (purged && purged.hardDeletedAt) ids.push(purged.id);
  }

  return {
    scanned: candidates.length,
    purged: ids.length,
    skipped: candidates.length - due.length,
    ids,
  };
}
