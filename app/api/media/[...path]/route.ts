import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getActor, isAdmin } from "@/lib/access";
import { canAccessOrganization } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";
import { appendDocumentAudit } from "@/lib/documents/audit";
import { isVisibleDocument } from "@/lib/documents/visibility";
import { resolveMediaFile } from "@/lib/media/fs";
import { safeMediaRel } from "@/lib/media/paths";

function isOrgPlanRel(rel: string) {
  return (
    rel.startsWith("orgs/") &&
    (rel.includes("/plans/") || /\.(pdf|docx?|txt|md|csv)$/i.test(rel))
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: parts } = await context.params;
  const rel = safeMediaRel(parts.join("/"));
  if (!rel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [prefix, orgId] = rel.split("/");
  const tracked = isOrgPlanRel(rel)
    ? await prisma.clientDocument.findFirst({ where: { storageKey: rel } })
    : null;

  if (tracked) {
    if (!isVisibleDocument(tracked) || !tracked.storageKey) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !isAdmin(actor) &&
      !(await canAccessOrganization(actor, tracked.organizationId))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await appendDocumentAudit({
      action: "VIEWED",
      organizationId: tracked.organizationId,
      sessionId: tracked.sessionId,
      actorId: actor.id,
      documentId: tracked.id,
      target: tracked.storageKey,
      reason: "media_view",
    });
  } else if (prefix === "orgs") {
    if (
      !orgId ||
      (!isAdmin(actor) && !(await canAccessOrganization(actor, orgId)))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const resolved = await resolveMediaFile(rel);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await readFile(resolved.abs);
  const isOrgDoc = prefix === "orgs";
  return new NextResponse(body, {
    headers: {
      "Content-Type": resolved.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(isOrgDoc
        ? {
            "Content-Disposition": `attachment; filename="${rel.split("/").pop()}"`,
          }
        : {}),
    },
  });
}
