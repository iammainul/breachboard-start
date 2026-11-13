import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { writeMediaFile } from "@/lib/media/fs";
import { requireApiAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { validateUpload } from "@/lib/security/upload";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;
  const { id } = await context.params;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const injectId = String(form.get("injectId") ?? "").trim();
  const file = form.get("file");
  if (!injectId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "injectId and file are required" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = validateUpload({
    kind: "inject-media",
    filename: file.name,
    declaredMime: file.type,
    bytes,
    size: file.size,
  });
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: checked.status });
  }
  const kind = checked.kind === "video" ? ("video" as const) : ("image" as const);

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.isTemplate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (exercise.status !== "draft") {
    return NextResponse.json(
      {
        error:
          exercise.status === "accepted"
            ? "Accepted packs are locked. Fork a new draft to edit."
            : "Retired scenarios cannot be edited.",
      },
      { status: 409 },
    );
  }
  const docParsed = parseExerciseDocument(exercise.document);
  if (!docParsed.success) {
    return NextResponse.json({ error: "Scenario unreadable" }, { status: 500 });
  }
  const document = docParsed.data;
  const idx = document.injects.findIndex((i) => i.id === injectId);
  if (idx < 0) {
    return NextResponse.json({ error: "Inject not found" }, { status: 404 });
  }

  const inject = document.injects[idx];
  const stamp = randomBytes(4).toString("hex");
  const fileName = `${injectId}-${stamp}.${checked.ext}`;
  const assetPath = await writeMediaFile(`uploads/${id}`, fileName, bytes);

  const entry = {
    kind,
    prompt: `Uploaded ${kind}: ${file.name || fileName}`,
    aspect: kind === "image" ? ("16:9" as const) : undefined,
    assetPath,
    source: "upload" as const,
  };

  const mediaPrompts = [...(inject.mediaPrompts ?? []), entry];
  const nextInjects = document.injects.slice();
  nextInjects[idx] = { ...inject, mediaPrompts };
  const nextDoc = { ...document, injects: nextInjects };

  await prisma.exercise.update({
    where: { id },
    data: { document: nextDoc },
  });

  return NextResponse.json({
    ok: true,
    injectId,
    kind,
    assetPath,
    mediaPrompts,
    document: nextDoc,
  });
}
