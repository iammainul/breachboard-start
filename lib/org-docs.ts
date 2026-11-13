import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { orgPlanContextFromDocuments } from "@/lib/documents/plan-context";
import { gradeExcerpt } from "@/lib/documents/extract";
import { resolveMediaFile } from "@/lib/media/fs";

const TEXT_EXT = new Set([".txt", ".md", ".csv"]);

export async function readOrgPlanExcerpt(
  relativePath: string | null | undefined,
  maxChars = 4000,
): Promise<string | null> {
  if (!relativePath) return null;
  const ext = path.extname(relativePath).toLowerCase();
  if (!TEXT_EXT.has(ext)) {
    return null;
  }
  const resolved = await resolveMediaFile(relativePath);
  if (!resolved) return null;
  try {
    const raw = await readFile(resolved.abs, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return gradeExcerpt(trimmed, maxChars);
  } catch {
    return null;
  }
}

export async function orgPlanContext(
  org: {
    id?: string;
    crisisDocPath?: string | null;
    crisisDocName?: string | null;
    ircDocPath?: string | null;
    ircDocName?: string | null;
  },
  sessionId?: string | null,
) {
  if (org.id) {
    const fromRecords = await orgPlanContextFromDocuments({
      organizationId: org.id,
      sessionId,
    });
    if (fromRecords.trim()) return fromRecords;
  }

  const [crisis, irc] = await Promise.all([
    readOrgPlanExcerpt(org.crisisDocPath),
    readOrgPlanExcerpt(org.ircDocPath),
  ]);
  const parts: string[] = [];
  if (org.crisisDocName || crisis) {
    parts.push(
      `Crisis management plan${org.crisisDocName ? ` (${org.crisisDocName})` : ""}:\n${crisis ?? "(binary file on record — score coordination with an org CMP, do not invent clauses.)"}`,
    );
  }
  if (org.ircDocName || irc) {
    parts.push(
      `Incident response / IRC document${org.ircDocName ? ` (${org.ircDocName})` : ""}:\n${irc ?? "(binary file on record — score against typical IRC/IRP duties, do not invent clause numbers.)"}`,
    );
  }
  return parts.join("\n\n");
}
