import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { appendDocumentAudit } from "@/lib/documents/audit";
import { resolveMediaFile } from "@/lib/media/fs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const doc = await prisma.clientDocument.findUnique({ where: { id } });
  if (!doc || doc.hardDeletedAt || !doc.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const resolved = await resolveMediaFile(doc.storageKey);
  if (!resolved) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  await appendDocumentAudit({
    action: "DOWNLOADED",
    organizationId: doc.organizationId,
    sessionId: doc.sessionId,
    actorId: actor.user.id,
    documentId: doc.id,
    target: doc.storageKey,
    reason: doc.softDeletedAt ? "admin_download_soft_deleted" : "admin_download",
  });

  const body = await readFile(resolved.abs);
  const filename = doc.originalName.replace(/[\r\n"]/g, "_");
  return new NextResponse(body, {
    headers: {
      "Content-Type": resolved.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
