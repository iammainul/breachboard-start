import { questionKey, type InjectQuestion } from "@/lib/schema/exercise";

/** Points are fine for participants (needed for score UI). Keep expectedAction server-only. */
export function participantQuestion(question: InjectQuestion) {
  return {
    roleId: question.roleId,
    roleIds: question.roleIds ?? [],
    common: Boolean(question.common),
    prompt: question.prompt,
    points: question.points,
    key: questionKey(question),
  };
}
