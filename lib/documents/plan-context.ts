import { prisma } from "@/lib/prisma";
import { GRADE_EXCERPT_CHARS } from "@/lib/documents/constants";
import { gradeExcerpt } from "@/lib/documents/extract";
import { activeDocumentWhere } from "@/lib/documents/visibility";

function labelFor(kind: string, filename: string) {
  if (kind === "CCMP") {
    return `Crisis management plan (${filename})`;
  }
  if (kind === "IRP") {
    return `Incident response / IRC document (${filename})`;
  }
  return `Organization plan (${filename})`;
}

/**
 * Active IRP/CCMP excerpts for AI grading. Soft-deleted and hard-deleted
 * rows are excluded. Truncated so LLM vendors do not receive full plans.
 */
export async function orgPlanContextFromDocuments(input: {
  organizationId: string;
  sessionId?: string | null;
  maxChars?: number;
}): Promise<string> {
  const max = input.maxChars ?? GRADE_EXCERPT_CHARS;
  const docs = await prisma.clientDocument.findMany({
    where: {
      organizationId: input.organizationId,
      ...activeDocumentWhere,
      OR: input.sessionId
        ? [{ sessionId: null }, { sessionId: input.sessionId }]
        : [{ sessionId: null }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      kind: true,
      originalName: true,
      extractedText: true,
      extractStatus: true,
    },
  });

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const doc of docs) {
    if (seen.has(doc.kind)) continue;
    seen.add(doc.kind);
    const excerpt = gradeExcerpt(doc.extractedText, max);
    if (excerpt) {
      parts.push(`${labelFor(doc.kind, doc.originalName)}:\n${excerpt}`);
    } else {
      parts.push(
        `${labelFor(doc.kind, doc.originalName)}:\n(binary file on record — ${doc.extractStatus === "failed" ? "text extraction failed; " : ""}score coordination with typical IRP/CCMP duties, do not invent clauses.)`,
      );
    }
  }
  return parts.join("\n\n");
}
