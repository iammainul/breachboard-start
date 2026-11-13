import { prisma } from "@/lib/prisma";
import { kindToSlot } from "@/lib/documents/constants";
import { publicMediaPath } from "@/lib/media/paths";
import { activeDocumentWhere } from "@/lib/documents/visibility";

/**
 * Keep Organization.crisisDoc* / ircDoc* in sync with the latest active
 * org-level CCMP / IRP so existing grading and org UI keep working.
 */
export async function syncOrgPlanPointers(organizationId: string) {
  const active = await prisma.clientDocument.findMany({
    where: {
      organizationId,
      sessionId: null,
      ...activeDocumentWhere,
    },
    orderBy: { createdAt: "desc" },
    select: {
      kind: true,
      storageKey: true,
      originalName: true,
    },
  });

  let crisisDocPath: string | null = null;
  let crisisDocName: string | null = null;
  let ircDocPath: string | null = null;
  let ircDocName: string | null = null;

  for (const doc of active) {
    const slot = kindToSlot(doc.kind);
    if (slot === "crisis" && !crisisDocPath) {
      crisisDocPath = publicMediaPath(doc.storageKey);
      crisisDocName = doc.originalName;
    }
    if (slot === "irc" && !ircDocPath) {
      ircDocPath = publicMediaPath(doc.storageKey);
      ircDocName = doc.originalName;
    }
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: { crisisDocPath, crisisDocName, ircDocPath, ircDocName },
  });
}
