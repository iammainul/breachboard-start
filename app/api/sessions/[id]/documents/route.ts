import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageLiveSession,
  isAdmin,
  requireApiUserForSession,
} from "@/lib/access";
import { serializeClientDocument } from "@/lib/documents/serialize";
import { activeDocumentWhere } from "@/lib/documents/visibility";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: { seats: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const seat = session.seats.find((item) => item.userId === actor.user.id);
  if (!isAdmin(actor.user) && !canManageLiveSession(actor.user, seat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.clientDocument.findMany({
    where: {
      organizationId: session.organizationId,
      ...activeDocumentWhere,
      OR: [{ sessionId: null }, { sessionId: session.id }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      session: {
        select: { id: true, joinCode: true, runKind: true, status: true },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    documents: documents.map(serializeClientDocument),
  });
}
