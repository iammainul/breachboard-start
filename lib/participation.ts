import type { ExerciseDocument } from "@/lib/schema/exercise";
import {
  canAnswerQuestion,
  questionKey,
  type InjectQuestion,
} from "@/lib/schema/exercise";

type Inject = ExerciseDocument["injects"][number];

export type ParticipationState =
  | "inactive"
  | "active"
  | "observer"
  | "facilitator"
  | "admin_view";

export type TeamInfo = { id: string; name: string; memberUserIds: string[] };

export function resolveActiveTeamIds(
  inject: { activeTeamIds?: string[] },
  teams: TeamInfo[],
): string[] | "all" {
  const configured = inject.activeTeamIds ?? [];
  if (teams.length === 0) return "all";
  if (configured.length === 0) return "all";
  const matched = configured.filter((id) => teams.some((t) => t.id === id));
  // Scenario docs use team-definition ids (e.g. "blue") that do not match
  // SessionTeam cuids — treat that as all teams rather than locking everyone out.
  if (matched.length === 0) return "all";
  return matched;
}

export function teamIdForUser(teams: TeamInfo[], userId: string): string | null {
  const team = teams.find((t) => t.memberUserIds.includes(userId));
  return team?.id ?? null;
}

export function computeParticipation(input: {
  userId: string;
  seatKind: string | null | undefined;
  playbookRoleId: string | null | undefined;
  teams: TeamInfo[];
  inject: Inject | null | undefined;
  isAdminViewer?: boolean;
}): {
  state: ParticipationState;
  teamId: string | null;
  canSeeInject: boolean;
  answerableQuestionKeys: string[];
  visibleQuestions: InjectQuestion[];
} {
  const { seatKind, playbookRoleId, teams, inject, userId, isAdminViewer } = input;
  const teamId = teamIdForUser(teams, userId);

  if (seatKind === "MODERATOR") {
    return {
      state: "facilitator",
      teamId,
      canSeeInject: true,
      answerableQuestionKeys: [],
      visibleQuestions: inject?.questions ?? [],
    };
  }
  if (seatKind === "OBSERVER") {
    return {
      state: "observer",
      teamId,
      canSeeInject: true,
      answerableQuestionKeys: [],
      visibleQuestions: inject?.questions ?? [],
    };
  }
  if (!seatKind && isAdminViewer) {
    return {
      state: "admin_view",
      teamId: null,
      canSeeInject: true,
      answerableQuestionKeys: [],
      visibleQuestions: inject?.questions ?? [],
    };
  }
  if (seatKind !== "PARTICIPANT" || !inject) {
    return {
      state: "inactive",
      teamId,
      canSeeInject: false,
      answerableQuestionKeys: [],
      visibleQuestions: [],
    };
  }

  const active = resolveActiveTeamIds(inject, teams);
  const onActiveTeam =
    active === "all"
      ? teams.length === 0 || teamId != null
      : teamId != null && active.includes(teamId);

  // Not onboarded onto any team while teams exist
  if (teams.length > 0 && teamId == null) {
    // Squad members without a playbook role may still watch the inject.
    if (!playbookRoleId) {
      return {
        state: "active",
        teamId: null,
        canSeeInject: true,
        answerableQuestionKeys: [],
        visibleQuestions: inject.questions,
      };
    }
    return {
      state: "inactive",
      teamId: null,
      canSeeInject: false,
      answerableQuestionKeys: [],
      visibleQuestions: [],
    };
  }

  if (!onActiveTeam) {
    return {
      state: "inactive",
      teamId,
      canSeeInject: false,
      answerableQuestionKeys: [],
      visibleQuestions: [],
    };
  }

  const visibleQuestions = inject.questions;
  const answerableQuestionKeys = visibleQuestions
    .filter((q) => canAnswerQuestion(q, playbookRoleId))
    .map((q) => questionKey(q));

  return {
    state: "active",
    teamId,
    canSeeInject: true,
    answerableQuestionKeys,
    visibleQuestions,
  };
}

export function expectedAnswerCount(
  inject: Inject,
  seats: { kind: string; playbookRoleId: string | null; userId: string }[],
  teams: TeamInfo[],
) {
  const active = resolveActiveTeamIds(inject, teams);
  return seats.filter((seat) => {
    if (seat.kind !== "PARTICIPANT" || !seat.playbookRoleId) return false;
    const teamId = teamIdForUser(teams, seat.userId);
    if (teams.length > 0 && teamId == null) return false;
    const onActive =
      active === "all" ? teams.length === 0 || teamId != null : teamId != null && active.includes(teamId);
    if (!onActive) return false;
    return inject.questions.some((q) => canAnswerQuestion(q, seat.playbookRoleId));
  }).length;
}
