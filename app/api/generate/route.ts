import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { generateRequestSchema } from "@/lib/schema/exercise";
import { generateScenario } from "@/lib/ai/generate-scenario";
import { prisma } from "@/lib/prisma";
import { importAdvisory } from "@/lib/intel/import";
import { scenarioLineageKey } from "@/lib/scenario-packs";
import { ensureInjectStageAssets } from "@/lib/media/ensure-inject-media";

export async function POST(request: Request) {
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  const json = await request.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.advisoryText?.trim()) {
      await importAdvisory({
        source: "MANUAL",
        title: `Generate input ${new Date().toISOString()}`,
        body: parsed.data.advisoryText,
      });
    }

    const { document: drafted } = await generateScenario(parsed.data);
    const exercise = await prisma.exercise.create({
      data: {
        title: drafted.title,
        durationMin: drafted.durationMin,
        sector: drafted.sector,
        status: "draft",
        lineageKey: scenarioLineageKey(drafted.title),
        document: drafted,
        authorId: actor.user.id,
        organizationId: parsed.data.organizationId || null,
      },
    });
    const org = parsed.data.organizationId
      ? await prisma.organization.findUnique({
          where: { id: parsed.data.organizationId },
          select: { name: true, sector: true, notes: true },
        })
      : null;
    const document = await ensureInjectStageAssets(exercise.id, drafted, {
      tryAi: true,
      org,
    });
    await prisma.exercise.update({
      where: { id: exercise.id },
      data: { document },
    });
    return NextResponse.json({
      id: exercise.id,
      document,
      media: document.injects.map((inject) => ({
        injectId: inject.id,
        source: inject.mediaPrompts?.find((m) => m.kind === "image")?.source ?? "missing",
        error: inject.mediaPrompts?.find((m) => m.kind === "image")?.error,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
