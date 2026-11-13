import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { SLOT_KINDS, slotToKind, type SlotKind } from "@/lib/documents/constants";
import {
  persistClientDocument,
  softDeleteClientDocument,
} from "@/lib/documents/lifecycle";
import { resolveRetentionDays } from "@/lib/documents/retention";
import { activeDocumentWhere } from "@/lib/documents/visibility";
import { deleteMediaFile } from "@/lib/media/fs";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { validateUpload } from "@/lib/security/upload";

const KIND = new Set(SLOT_KINDS);

function serializeOrg(org: {
  id: string;
  crisisDocPath: string | null;
  crisisDocName: string | null;
  ircDocPath: string | null;
  ircDocName: string | null;
  documentRetentionDays: number;
}) {
  return {
    id: org.id,
    crisisDocPath: org.crisisDocPath,
    crisisDocName: org.crisisDocName,
    ircDocPath: org.ircDocPath,
    ircDocName: org.ircDocName,
    documentRetentionDays: org.documentRetentionDays,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "").trim() as SlotKind;
  const file = form.get("file");
  if (!KIND.has(kind) || !(file instanceof File)) {
    return NextResponse.json(
      { error: "kind (crisis|irc) and file are required" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const checked = validateUpload({
    kind: "org-doc",
    filename: file.name,
    declaredMime: file.type,
    bytes: buf,
    size: file.size,
  });
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: checked.status });
  }

  const sessionIdRaw = String(form.get("sessionId") ?? "").trim();
  const sessionId = sessionIdRaw || null;
  if (sessionId) {
    const session = await prisma.exerciseSession.findUnique({
      where: { id: sessionId },
      select: { id: true, organizationId: true, documentRetentionDays: true },
    });
    if (!session || session.organizationId !== org.id) {
      return NextResponse.json({ error: "Unknown session" }, { status: 400 });
    }
  }

  const sessionDays = sessionId
    ? (
        await prisma.exerciseSession.findUnique({
          where: { id: sessionId },
          select: { documentRetentionDays: true },
        })
      )?.documentRetentionDays
    : null;

  await persistClientDocument({
    organizationId: org.id,
    sessionId,
    uploadedById: actor.user.id,
    slot: kind,
    originalName: checked.displayName,
    mimeType: checked.mime,
    bytes: buf,
    ext: checked.ext,
    replaceSameKind: true,
    retention: {
      uploadDays: form.get("retentionDays")
        ? Number(form.get("retentionDays"))
        : null,
      sessionDays,
      orgDays: org.documentRetentionDays,
    },
  });

  const updated = await prisma.organization.findUnique({ where: { id: org.id } });
  return NextResponse.json({
    ...serializeOrg(updated!),
    retentionDays: resolveRetentionDays({
      uploadDays: form.get("retentionDays")
        ? Number(form.get("retentionDays"))
        : null,
      sessionDays,
      orgDays: org.documentRetentionDays,
    }),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;
  const kind = new URL(request.url).searchParams.get("kind");
  if (!kind || !KIND.has(kind as SlotKind)) {
    return NextResponse.json({ error: "kind=crisis|irc required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documentKind = slotToKind(kind as SlotKind);
  const existing = await prisma.clientDocument.findFirst({
    where: {
      organizationId: org.id,
      sessionId: null,
      kind: documentKind,
      ...activeDocumentWhere,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await softDeleteClientDocument({
      id: existing.id,
      actorId: actor.user.id,
      reason: "admin_remove",
    });
  } else {
    const previous = kind === "crisis" ? org.crisisDocPath : org.ircDocPath;
    await prisma.organization.update({
      where: { id: org.id },
      data:
        kind === "crisis"
          ? { crisisDocPath: null, crisisDocName: null }
          : { ircDocPath: null, ircDocName: null },
    });
    if (previous) {
      await deleteMediaFile(previous);
    }
  }

  const updated = await prisma.organization.findUnique({ where: { id: org.id } });
  return NextResponse.json(serializeOrg(updated!));
}
