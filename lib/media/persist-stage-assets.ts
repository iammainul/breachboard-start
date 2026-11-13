import { prisma } from "@/lib/prisma";
import {
  parseExerciseDocument,
  type ExerciseDocument,
} from "@/lib/schema/exercise";
import { ensureInjectStageAssets } from "@/lib/media/ensure-inject-media";
import { logError } from "@/lib/logger";

const inflight = new Map<string, Promise<ExerciseDocument | null>>();

/**
 * Write fallback stage cards if files are missing. Coalesces concurrent
 * calls for the same exercise so a room of participants joining at once
 * does not stampede Prisma / disk. Callers that render a session should
 * schedule this with `after()` so it does not block the HTML response.
 */
export async function persistStageAssets(
  exerciseId: string,
): Promise<ExerciseDocument | null> {
  const existing = inflight.get(exerciseId);
  if (existing) return existing;
  const job = persistStageAssetsOnce(exerciseId)
    .catch((err) => {
      logError("persistStageAssets failed", err, { exerciseId });
      return null;
    })
    .finally(() => {
      inflight.delete(exerciseId);
    });
  inflight.set(exerciseId, job);
  return job;
}

async function persistStageAssetsOnce(
  exerciseId: string,
): Promise<ExerciseDocument | null> {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return null;
  const parsed = parseExerciseDocument(exercise.document);
  if (!parsed.success) return null;
  const next = await ensureInjectStageAssets(exerciseId, parsed.data);
  if (JSON.stringify(next) === JSON.stringify(parsed.data)) return parsed.data;
  await prisma.exercise.update({
    where: { id: exerciseId },
    data: { document: next },
  });
  return next;
}
