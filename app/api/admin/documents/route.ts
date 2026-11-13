import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { serializeClientDocument } from "@/lib/documents/serialize";
import { adminListWhere } from "@/lib/documents/visibility";

export async function GET(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const url = new URL(request.url);
  const includeSoftDeleted = url.searchParams.get("includeSoftDeleted") !== "0";
  const includeHardDeleted = url.searchParams.get("includeHardDeleted") === "1";
  const organizationId = url.searchParams.get("organizationId") ?? undefined;

  const documents = await prisma.clientDocument.findMany({
    where: adminListWhere({
      includeSoftDeleted,
      includeHardDeleted,
      organizationId,
    }),
    orderBy: { createdAt: "desc" },
    take: 200,
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
