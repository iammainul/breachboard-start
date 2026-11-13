import "server-only";

import { prisma } from "@/lib/prisma";
import {
  scenarioLineageKey,
  transferredLineageKey,
} from "@/lib/scenario-packs";

export { scenarioLineageKey } from "@/lib/scenario-packs";

export async function acceptScenario(
  exerciseId: string,
  organizationId?: string | null,
) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: { clients: { select: { organizationId: true } } },
  });
  if (!exercise || exercise.isTemplate) {
    return { error: "Not found", status: 404 } as const;
  }
  if (exercise.status === "retired") {
    return { error: "Retired scenarios cannot be accepted", status: 400 } as const;
  }

  const orgId = organizationId || exercise.organizationId;
  if (!orgId) {
    return {
      error: "Select a working organization before accepting this pack",
      status: 400,
    } as const;
  }

  const alreadyLinked = exercise.clients.some((row) => row.organizationId === orgId);
  if (exercise.status === "accepted" && (exercise.organizationId === orgId || alreadyLinked)) {
    if (!alreadyLinked) {
      await prisma.exerciseClient.createMany({
        data: [{ exerciseId: exercise.id, organizationId: orgId }],
        skipDuplicates: true,
      });
    }
    return { exercise } as const;
  }

  const draftKey =
    exercise.lineageKey?.trim() || scenarioLineageKey(exercise.title);

  const previous = await prisma.exercise.findFirst({
    where: {
      id: { not: exercise.id },
      isTemplate: false,
      status: "accepted",
      OR: [
        { organizationId: orgId },
        { clients: { some: { organizationId: orgId } } },
      ],
      AND: [
        {
          OR: [
            { lineageKey: draftKey },
            { lineageKey: null, title: exercise.title },
          ],
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  const lineageKey = transferredLineageKey(previous, exercise);

  await prisma.$transaction(async (tx) => {
    if (previous) {
      await tx.exercise.update({
        where: { id: previous.id },
        data: { status: "retired", lineageKey },
      });
    }
    await tx.exercise.update({
      where: { id: exercise.id },
      data: {
        status: "accepted",
        lineageKey,
        organizationId: orgId,
      },
    });
    await tx.exerciseClient.createMany({
      data: [{ exerciseId: exercise.id, organizationId: orgId }],
      skipDuplicates: true,
    });
  });

  const updated = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  return { exercise: updated!, previousId: previous?.id ?? null } as const;
}

export async function forkAcceptedDraft(exerciseId: string, authorId: string) {
  const source = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!source || source.isTemplate) {
    return { error: "Not found", status: 404 } as const;
  }
  if (source.status !== "accepted") {
    return {
      error: "Only accepted scenarios can spawn a new draft",
      status: 400,
    } as const;
  }
  const lineageKey = source.lineageKey || scenarioLineageKey(source.title);
  const draft = await prisma.exercise.create({
    data: {
      title: source.title,
      durationMin: source.durationMin,
      sector: source.sector,
      status: "draft",
      document: source.document as object,
      lineageKey,
      libraryTags: source.libraryTags,
      coverImagePath: source.coverImagePath,
      organizationId: source.organizationId,
      authorId,
    },
  });
  return { exercise: draft } as const;
}

export async function replaceScenarioClients(
  exerciseId: string,
  organizationIds: string[],
) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: { clients: { select: { organizationId: true } } },
  });
  if (!exercise || exercise.isTemplate) {
    return { error: "Not found", status: 404 } as const;
  }
  if (exercise.status !== "accepted") {
    return {
      error: "Only accepted packs can be linked to clients",
      status: 400,
    } as const;
  }

  const unique = [...new Set(organizationIds.filter(Boolean))];
  const orgs = unique.length
    ? await prisma.organization.findMany({
        where: { id: { in: unique } },
        select: { id: true },
      })
    : [];
  if (orgs.length !== unique.length) {
    return { error: "One or more clients were not found", status: 400 } as const;
  }

  const primaryId = unique[0] ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.exerciseClient.deleteMany({ where: { exerciseId } });
    if (unique.length) {
      await tx.exerciseClient.createMany({
        data: unique.map((organizationId) => ({ exerciseId, organizationId })),
      });
    }
    await tx.exercise.update({
      where: { id: exerciseId },
      data: { organizationId: primaryId },
    });
  });

  const updated = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      organization: { select: { id: true, name: true } },
      clients: {
        include: { organization: { select: { id: true, name: true } } },
      },
    },
  });
  return { exercise: updated! } as const;
}

export async function deleteScenario(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: { _count: { select: { sessions: true } } },
  });
  if (!exercise || exercise.isTemplate) {
    return { error: "Not found", status: 404 } as const;
  }
  if (exercise._count.sessions > 0) {
    return {
      error: `This pack has ${exercise._count.sessions} run${
        exercise._count.sessions === 1 ? "" : "s"
      }. Close or archive them before deleting.`,
      status: 409,
    } as const;
  }

  await prisma.exercise.delete({ where: { id: exerciseId } });
  return { ok: true as const };
}
