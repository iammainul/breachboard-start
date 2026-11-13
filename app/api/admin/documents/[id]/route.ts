import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import {
  hardDeleteClientDocument,
  restoreClientDocument,
  softDeleteClientDocument,
} from "@/lib/documents/lifecycle";
import { serializeClientDocument } from "@/lib/documents/serialize";

const bodySchema = z.object({
  action: z.enum(["soft-delete", "restore", "hard-delete"]),
  reason: z.string().max(240).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const doc = await prisma.clientDocument.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      session: {
        select: { id: true, joinCode: true, runKind: true, status: true },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeClientDocument(doc));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "soft-delete") {
      const updated = await softDeleteClientDocument({
        id,
        actorId: actor.user.id,
        reason: parsed.data.reason?.trim() || "admin_soft_delete",
      });
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(serializeClientDocument(updated));
    }
    if (parsed.data.action === "restore") {
      const updated = await restoreClientDocument({
        id,
        actorId: actor.user.id,
        reason: parsed.data.reason?.trim() || "admin_restore",
      });
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(serializeClientDocument(updated));
    }
    const updated = await hardDeleteClientDocument({
      id,
      actorId: actor.user.id,
      reason: parsed.data.reason?.trim() || "admin_hard_delete",
    });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeClientDocument(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
