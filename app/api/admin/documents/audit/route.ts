import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { serializeAuditEvent } from "@/lib/documents/serialize";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const documentId = url.searchParams.get("documentId") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;

  const events = await prisma.documentAuditEvent.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(documentId ? { documentId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      organization: { select: { name: true } },
    },
  });

  return NextResponse.json({ events: events.map(serializeAuditEvent) });
}
