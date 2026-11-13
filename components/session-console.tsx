"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DISCUSS_PHASE_HINT,
  DISCUSS_TIMER_CAPTION,
  DISCUSS_TIMER_LABEL,
  InjectCountdown,
  InjectProgress,
  JoinCodeBadge,
  PointsChip,
  PresenceBadge,
  QuestCard,
  ScorePanel,
  StatusBadge,
  TechniqueChip,
} from "@/components/game-ui";
import { InjectMediaList } from "@/components/inject-media";
import { FlashCard } from "@/components/page-frame";
import { TeamPanel } from "@/components/team-panel";
import { RoleInvitePanel } from "@/components/role-invite-panel";
import { cn, formatDateTime, seatLabel } from "@/lib/cn";
import {
  earnedPoints,
  maxPointsForRoleQuestions,
  overrideScoreError,
  pointsForRole,
} from "@/lib/game-score";
import { mergeSessionPollPayload, sessionNeedsFullReload } from "@/lib/merge-session-poll";
import { usePollingResource } from "@/lib/use-polling-resource";
import { useSessionPollIntervals } from "@/lib/use-session-poll-intervals";
import { openStageWindow } from "@/lib/open-stage-window";
import { DISCUSS_SECONDS } from "@/lib/session-clock";

type Role = { id: string; name: string; description: string };
type Question = {
  roleId: string;
  roleIds?: string[];
  common?: boolean;
  prompt: string;
  expectedAction?: string;
  points?: number;
  canAnswer?: boolean;
  key?: string;
};
type Inject = {
  id: string;
  sequence: number;
  title?: string;
  body?: string;
  timerSeconds: number;
  techniqueIds?: string[];
  activeTeamIds?: string[];
  aiGradeRubric?: string;
  /** Omitted on future injects for participants (`{ id, sequence }`). */
  questions?: Question[];
  mediaPrompts?: {
    kind: "image" | "video";
    prompt: string;
    assetPath?: string;
    source?: "generated" | "fallback" | "upload";
    error?: string;
  }[];
};
type Seat = {
  id: string;
  kind: string;
  playbookRoleId: string | null;
  teamId?: string | null;
  user: { id: string; name: string; email: string };
  presence?: "online" | "waiting" | "left";
  lastSeenAt?: string | null;
};
type Answer = {
  id: string;
  injectId: string;
  userId: string;
  userName: string;
  playbookRoleId: string;
  body: string;
  autoPoints?: number;
  pointsAwarded?: number;
  needsReview?: boolean;
  aiNotes?: string | null;
  overrideComment?: string | null;
};
type Person = {
  id: string;
  name: string;
  email: string;
  canFacilitate?: boolean;
  organization: { name: string } | null;
};
type Team = { id: string; name: string; memberUserIds: string[] };
type DockTab = "squad" | "invites" | "teams";
type Payload = {
  id: string;
  joinCode: string;
  status: string;
  runKind?: string;
  phase: string;
  discussSeconds?: number;
  createdAt?: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  closedAt?: string | null;
  currentInjectId: string | null;
  currentInjectStartedAt: string | null;
  organization: { name: string };
  exercise: { id: string; title: string; durationMin: number };
  exerciseRevision?: string;
  roles: Role[];
  teams: Team[];
  injects: Inject[];
  currentInject: Inject | null;
  seats: Seat[];
  answers: Answer[];
  mySeat: {
    id: string;
    kind: string;
    playbookRoleId: string | null;
    teamId?: string | null;
  } | null;
  myParticipation: {
    state: string;
    teamId: string | null;
    canSeeInject: boolean;
    answerableQuestionKeys: string[];
  };
  completion: {
    answered: number;
    expected: number;
    pendingUserIds?: string[];
    pending?: { userId: string; name: string; roleId: string | null }[];
    answeredPeople?: { userId: string; name: string; roleId: string | null }[];
  } | null;
  injectTeamPlan: Record<string, string[]>;
  isAdmin: boolean;
  canManage: boolean;
  canFacilitate: boolean;
  people: Person[];
  missingRoles?: { roleId: string; roleName: string }[];
};

export function SessionConsole({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("invites");

  const poll = useSessionPollIntervals();
  const { data, error, setError, reload } = usePollingResource<Payload>({
    url: `/api/sessions/${sessionId}`,
    intervalMs: poll.visibleMs,
    hiddenIntervalMs: poll.hiddenMs,
    merge: mergeSessionPollPayload,
    needsFullReload: sessionNeedsFullReload,
  });

  async function load() {
    await reload();
  }

  const roleName = useMemo(() => {
    const map = new Map((data?.roles ?? []).map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? id : "—");
  }, [data?.roles]);

  const teamName = useMemo(() => {
    const map = new Map((data?.teams ?? []).map((t) => [t.id, t.name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? id : null);
  }, [data?.teams]);

  const participantProgress = useMemo(() => {
    if (!data?.mySeat) return null;
    const myUserId = data.seats.find((s) => s.id === data.mySeat?.id)?.user.id;
    if (!myUserId) return null;
    const completedInjectIds = new Set(
      data.answers
        .filter((item) => item.userId === myUserId)
        .map((item) => item.injectId),
    );
    return {
      completed: completedInjectIds.size,
      total: data.injects.length,
    };
  }, [data]);

  const discussSeconds = data?.discussSeconds ?? DISCUSS_SECONDS;
  const discussing = Boolean(
    data && data.status === "live" && data.phase === "discuss",
  );

  if (!data) {
    return (
      <div className="flash-card flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[14px] text-muted">{error ?? "Loading exercise…"}</p>
      </div>
    );
  }

  const participant = data.mySeat?.kind === "PARTICIPANT";
  const observing =
    data.mySeat?.kind === "OBSERVER" || data.myParticipation.state === "observer";
  const live = data.status === "live";
  const isDraftRun = data.runKind === "draft";
  const inactive =
    participant && live && data.myParticipation.state === "inactive";
  const myUserId = data.seats.find((s) => s.id === data.mySeat?.id)?.user.id;
  const myInjectAnswer = data.answers.find(
    (a) => a.injectId === data.currentInject?.id && a.userId === myUserId,
  );
  const canAnswer =
    !data.isAdmin &&
    participant &&
    live &&
    data.phase === "answering" &&
    data.myParticipation.state === "active" &&
    data.myParticipation.answerableQuestionKeys.length > 0;
  const needsFacilitatorSeat =
    data.isAdmin && data.canFacilitate && !data.canManage && !data.mySeat;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not update run");
      return;
    }
    await load();
    router.refresh();
  }

  async function claimFacilitatorSeat() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/seats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "MODERATOR", claimSelf: true }),
    });
    setBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not claim facilitator seat");
      return;
    }
    await load();
  }

  async function submitAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.currentInject) return;
    setBusy(true);
    const response = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ injectId: data.currentInject.id, text: answer }),
    });
    setBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not submit");
      return;
    }
    setAnswer("");
    await load();
  }

  return (
    <div
      className="glass-scroll grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain max-lg:auto-rows-min lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(288px,332px)] lg:items-stretch lg:overflow-hidden"
      data-seat={observing ? "observer" : participant ? "participant" : undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-col lg:h-full lg:overflow-hidden">
        {needsFacilitatorSeat ? (
          <FlashCard className="glass-chrome mb-2.5 shrink-0 px-4 py-3.5">
            <p className="text-[14px] text-fg-2">
              You’re Admin with facilitate permission, but not seated on this run.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void claimFacilitatorSeat()}
              className="btn btn-primary mt-2.5"
            >
              Seat myself as Facilitator
            </button>
          </FlashCard>
        ) : null}
        {data.isAdmin && !data.canFacilitate && !data.canManage ? (
          <FlashCard className="mb-2.5 shrink-0 px-4 py-3.5">
            <p className="text-[14px] text-muted">
              Admin-only view — you can observe this run but cannot go live. Enable
              “Can facilitate” on your account and get a Facilitator seat.
            </p>
          </FlashCard>
        ) : null}

        <FlashCard className="glass-chrome z-20 shrink-0 px-4 py-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-hover">
                  {data.organization.name}
                </span>
                <StatusBadge status={data.status} />
                {observing ? (
                  <span className="chip h-6 px-2 text-[10px]">Observing</span>
                ) : null}
                {isDraftRun ? (
                  <span className="chip h-6 px-2 text-[10px]">Draft</span>
                ) : null}
              </div>
              <h1 className="mt-1 text-[18px] font-bold leading-snug tracking-tight text-fg sm:text-[20px]">
                {data.exercise.title}
              </h1>
              <p className="mt-1 text-[12px] text-muted">
                {data.exercise.durationMin} min ·{" "}
                {data.mySeat
                  ? `${seatLabel(data.mySeat.kind)}${
                      data.mySeat.playbookRoleId
                        ? ` · ${roleName(data.mySeat.playbookRoleId)}`
                        : data.mySeat.kind === "PARTICIPANT"
                          ? " · squad"
                          : ""
                    }${
                      data.myParticipation.teamId
                        ? ` · ${teamName(data.myParticipation.teamId)}`
                        : ""
                    }`
                  : "Run view"}
                {data.startedAt
                  ? ` · Started ${formatDateTime(data.startedAt)}`
                  : data.scheduledAt
                    ? ` · Scheduled ${formatDateTime(data.scheduledAt)}`
                    : ""}
              </p>
              <div className="mt-1.5">
                <InjectProgress
                  injects={data.injects}
                  currentInjectId={data.currentInjectId}
                />
              </div>
            </div>
            <JoinCodeBadge code={data.joinCode} size="compact" />
          </div>

          {data.canManage && data.injects.length > 0 ? (
            <div className="glass-scroll mt-2 flex gap-1 overflow-x-auto pb-0.5">
              {data.injects.map((inject) => {
                const active = inject.id === data.currentInject?.id;
                const currentIndex = data.injects.findIndex(
                  (i) => i.id === data.currentInjectId,
                );
                const past =
                  currentIndex >= 0 &&
                  currentIndex >
                    data.injects.findIndex((i) => i.id === inject.id);
                return (
                  <button
                    key={inject.id}
                    type="button"
                    title={inject.title}
                    disabled={busy}
                    onClick={() => void patch({ currentInjectId: inject.id })}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1.5 text-left transition-colors ${
                      active
                        ? "bg-primary text-primary-fg"
                        : past
                          ? "bg-primary-wash text-primary-hover hover:bg-primary/20"
                          : "glass-tile text-muted hover:text-fg"
                    }`}
                  >
                    <span className="shrink-0 font-mono text-[10px] font-bold">
                      {String(inject.sequence).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-medium leading-tight">
                      {inject.title}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {observing ? (
            <div
              role="status"
              className="glass-inset mt-2 rounded-[var(--radius-control)] px-3 py-2.5"
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-signal">
                Observing
              </p>
              <p className="mt-1 text-[13px] text-fg-2">
                Read-only seat. Watch the inject and roster — you cannot submit
                answers.
              </p>
            </div>
          ) : null}

          {participant && data.mySeat?.playbookRoleId && myUserId ? (
            <div className="mt-2 max-w-sm">
              <ScorePanel
                earned={earnedPoints(
                  data.injects,
                  data.answers,
                  myUserId,
                  data.mySeat.playbookRoleId,
                )}
                total={pointsForRole(data.injects, data.mySeat.playbookRoleId)}
                answersCount={
                  data.answers.filter((a) => a.userId === myUserId).length
                }
                injectCount={data.injects.length}
              />
            </div>
          ) : null}

          {(data.status === "closed" || data.phase === "debrief") &&
          (data.canManage || participant) ? (
            <div className="mt-2">
              <Link
                href={`/sessions/${sessionId}/report`}
                className="btn btn-ghost h-8 text-[12px]"
              >
                After-action report
              </Link>
            </div>
          ) : null}

          {data.canManage ? (
            <div className="mt-2 flex flex-col gap-2 border-t border-border-soft pt-2">
              {data.status !== "live" &&
              !isDraftRun &&
              (data.missingRoles?.length ?? 0) > 0 ? (
                <p className="text-[11px] text-warn">
                  Seat required roles before go-live:{" "}
                  {data.missingRoles!.map((r) => r.roleName).join(", ")}.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {data.status !== "live" ? (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (!isDraftRun && (data.missingRoles?.length ?? 0) > 0)
                    }
                    onClick={() => void patch({ status: "live" })}
                    className="btn btn-primary h-9 disabled:opacity-50"
                  >
                    Start exercise
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch({ currentInjectId: "next" })}
                    className="btn btn-primary h-9"
                  >
                    Release next inject
                  </button>
                )}
                {discussing ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch({ phase: "answering" })}
                    className="btn btn-ghost h-9"
                  >
                    Open questions
                  </button>
                ) : null}
                {live && data.phase !== "debrief" && !discussing ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch({ phase: "debrief" })}
                    className="btn btn-ghost h-9"
                  >
                    Debrief
                  </button>
                ) : null}
                {data.phase === "debrief" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch({ phase: "answering" })}
                    className="btn btn-ghost h-9"
                  >
                    Resume answering
                  </button>
                ) : null}
                <Link
                  href={`/sessions/${sessionId}/present`}
                  className="btn btn-ghost h-9"
                  title="Facilitator controller + projector Stage"
                  onClick={() => {
                    try {
                      sessionStorage.setItem(`ttx-stage-opened:${sessionId}`, "1");
                    } catch {
                      /* ignore */
                    }
                    void openStageWindow(sessionId, true);
                  }}
                >
                  Open projector
                </Link>
                <Link
                  href={`/scenarios/${data.exercise.id}`}
                  className="btn btn-ghost h-9"
                >
                  Edit scenario
                </Link>
                {data.completion && live ? (
                  <span className="text-[12px] text-muted">
                    Responses {data.completion.answered}/{data.completion.expected}
                    {data.phase === "debrief" ? " · debrief" : ""}
                    {discussing ? " · discuss" : ""}
                  </span>
                ) : null}
                {data.status !== "closed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          "End this exercise for everyone? Players will move to after-action.",
                        )
                      ) {
                        return;
                      }
                      void patch({ status: "closed" });
                    }}
                    className="btn btn-danger ml-auto h-9"
                  >
                    End exercise
                  </button>
                ) : (
                  <span className="chip chip-on ml-auto">Closed</span>
                )}
              </div>
            </div>
          ) : null}
        </FlashCard>

        <div className="glass-scroll mt-2.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pb-2 lg:pr-1">
        {participant && participantProgress && !inactive ? (
          <FlashCard className="glass-reading shrink-0 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                  Activity progress
                </div>
                <p className="mt-1 text-[14px] font-semibold">
                  {participantProgress.completed} response milestone
                  {participantProgress.completed === 1 ? "" : "s"} completed
                </p>
              </div>
              <span className="glass-tile px-3 py-1.5 font-mono text-[13px] font-bold text-primary-hover">
                {participantProgress.completed}/{participantProgress.total}
              </span>
            </div>
          </FlashCard>
        ) : null}

        {inactive ? (
          <FlashCard className="flex flex-col items-center px-6 py-10 text-center">
            <div className="glass-tile flex h-14 w-14 items-center justify-center text-muted">
              <StandbyIcon className="h-7 w-7" />
            </div>
            <p className="mt-3 text-[16px] font-semibold text-fg">Standby</p>
            <p className="mt-1 max-w-sm text-[14px] text-muted">
              {data.teams.length > 0 && !data.myParticipation.teamId
                ? "You aren’t onboarded to a team for this run yet. Wait for the facilitator."
                : "Your playbook role isn’t answering this inject."}
            </p>
          </FlashCard>
        ) : data.currentInject ? (
          <FlashCard className="glass-reading p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-fg px-2.5 py-1 font-mono text-[12px] font-bold text-card">
                    INJ-{String(data.currentInject.sequence).padStart(2, "0")}
                  </span>
                  {data.canManage && (data.currentInject.questions?.length ?? 0) > 0 ? (
                    <PointsChip
                      points={(data.currentInject.questions ?? []).reduce(
                        (sum, question) => sum + (question.points ?? 0),
                        0,
                      )}
                      large
                    />
                  ) : null}
                </div>
                <h2 className="mt-1.5 text-[20px] font-bold tracking-tight">
                  {data.currentInject.title}
                </h2>
              </div>
              {live ? (
                discussing ? (
                  <InjectCountdown
                    seconds={discussSeconds}
                    injectId={`${data.currentInject.id}-discuss`}
                    active
                    startedAt={data.currentInjectStartedAt}
                    label={DISCUSS_TIMER_LABEL}
                    caption={DISCUSS_TIMER_CAPTION}
                    onExpired={() => {
                      void reload();
                      router.refresh();
                    }}
                  />
                ) : (
                  <InjectCountdown
                    seconds={data.currentInject.timerSeconds}
                    injectId={data.currentInject.id}
                    active={live && data.phase === "answering"}
                    startedAt={data.currentInjectStartedAt}
                  />
                )
              ) : (
                <div className="glass-tile px-4 py-2.5 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-meta">
                    Inject timer
                  </div>
                  <div className="mt-0.5 font-mono text-[22px] font-bold leading-none tabular-nums text-muted">
                    {Math.floor(data.currentInject.timerSeconds / 60)}:
                    {String(data.currentInject.timerSeconds % 60).padStart(2, "0")}
                  </div>
                </div>
              )}
            </div>

            {discussing ? (
              <p className="glass-inset mt-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] text-fg-2">
                {observing
                  ? `Watching discussion. ${DISCUSS_PHASE_HINT} ${DISCUSS_TIMER_CAPTION}.`
                  : `${DISCUSS_PHASE_HINT} ${DISCUSS_TIMER_CAPTION}.`}
              </p>
            ) : null}

            <div className="mt-3">
              <InjectMediaList items={data.currentInject.mediaPrompts} />
            </div>

            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">
              {data.currentInject.body}
            </p>

            {data.canManage && data.currentInject.aiGradeRubric ? (
              <div className="glass-inset mt-3 rounded-[var(--radius-control)] px-4 py-3">
                <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                  CISA scoring criteria · facilitator
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-2">
                  {data.currentInject.aiGradeRubric}
                </p>
                <p className="mt-1.5 text-[12px] text-muted">
                  Answers are auto-scored by AI against this rubric. Edit points in
                  Team responses below; overrides appear on the after-action report.
                </p>
              </div>
            ) : null}

            {data.currentInject.techniqueIds && data.currentInject.techniqueIds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.currentInject.techniqueIds.map((id) => (
                  <TechniqueChip key={id} id={id} />
                ))}
              </div>
            ) : null}

            {observing && (data.currentInject.questions?.length ?? 0) > 0 && !discussing ? (
              <div className="mt-4 grid gap-2.5 2xl:grid-cols-2">
                <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta 2xl:col-span-2">
                  Room prompts · view only
                </div>
                {(data.currentInject.questions ?? []).map((q) => {
                  const key =
                    q.key ??
                    `${q.common ? "common" : q.roleId}::${q.prompt}`;
                  return (
                    <QuestCard
                      key={key}
                      roleName={
                        q.common
                          ? "Common"
                          : roleName(q.roleId || q.roleIds?.[0])
                      }
                      prompt={q.prompt}
                      viewOnly
                    />
                  );
                })}
              </div>
            ) : (data.currentInject.questions?.length ?? 0) > 0 && !discussing ? (
              <div className="mt-4 grid gap-2.5 2xl:grid-cols-2">
                <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta 2xl:col-span-2">
                  {data.canManage ? "Objectives (all roles)" : "Your objectives"}
                </div>
                {(data.currentInject.questions ?? [])
                  .filter((q) => {
                    if (data.canManage) return true;
                    const key =
                      q.key ??
                      `${q.common ? "common" : q.roleId}::${q.prompt}`;
                    return (
                      q.canAnswer ??
                      data.myParticipation.answerableQuestionKeys.includes(key)
                    );
                  })
                  .map((q) => {
                  const key =
                    q.key ??
                    `${q.common ? "common" : q.roleId}::${q.prompt}`;
                  const answerable =
                    data.canManage ||
                    (q.canAnswer ??
                      data.myParticipation.answerableQuestionKeys.includes(key));
                  return (
                    <QuestCard
                      key={key}
                      roleName={
                        q.common
                          ? "Common"
                          : roleName(q.roleId || q.roleIds?.[0])
                      }
                      prompt={q.prompt}
                      points={q.points}
                      answered={Boolean(myInjectAnswer) && Boolean(answerable)}
                      cue={
                        q.expectedAction && data.canManage
                          ? q.expectedAction
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : participant ? (
              <p className="glass-inset mt-4 rounded-[var(--radius-control)] px-4 py-3 text-[14px] text-muted">
                This inject targets other roles — stay engaged and support the team.
              </p>
            ) : null}

            {canAnswer ? (
              <form
                onSubmit={submitAnswer}
                className="mt-4 flex flex-col gap-2.5 border-t border-border-soft pt-4"
              >
                <label className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
                  Submit your response
                </label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={5}
                  className="field min-h-28 text-[16px]"
                  placeholder="What actions does your role take right now?"
                />
                <button
                  type="submit"
                  disabled={busy || !answer.trim()}
                  className="btn btn-primary h-11 self-start disabled:opacity-50"
                >
                  {myInjectAnswer ? "Update response" : "Lock in response"}
                </button>
              </form>
            ) : participant && live && myInjectAnswer ? (
              <p className="glass-inset mt-4 rounded-[var(--radius-control)] px-4 py-3 text-[14px] text-fg-2">
                Your response is logged
                {data.phase !== "answering"
                  ? " — waiting for the facilitator to advance the run."
                  : "."}
              </p>
            ) : participant &&
              live &&
              data.myParticipation.state === "active" &&
              data.myParticipation.answerableQuestionKeys.length === 0 ? (
              <p className="glass-inset mt-4 rounded-[var(--radius-control)] px-4 py-3 text-[14px] text-muted">
                You’re active on this inject but there’s no question for your role —
                follow along.
              </p>
            ) : null}
          </FlashCard>
        ) : (
          <FlashCard className="flex flex-col items-center px-6 py-8 text-center">
            <div className="glass-tile flex h-11 w-11 items-center justify-center text-primary">
              <ShieldIcon className="h-5 w-5" />
            </div>
            <p className="mt-2.5 text-[15px] font-semibold text-fg">
              {data.status === "draft"
                ? "Waiting for the facilitator"
                : "No active inject"}
            </p>
            <p className="mt-1 max-w-sm text-[14px] text-muted">
              {data.status === "draft"
                ? "The exercise hasn't started yet. Grab your role and get ready."
                : "The floor is clear. Stand by for the next scenario beat."}
            </p>
          </FlashCard>
        )}

        {data.canManage &&
        data.currentInject &&
        data.answers.some((answer) => answer.injectId === data.currentInject?.id) ? (
          <FlashCard className="p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold">Team responses</h2>
            <p className="mt-1 text-[12px] text-muted">
              AI auto-score (CISA rubric) — adjust points and add override notes as needed.
            </p>
            <div className="mt-3 grid gap-2.5 2xl:grid-cols-2">
              {data.answers.filter((a) => a.injectId === data.currentInject?.id)
                .length === 0 ? (
                <p className="text-[13px] text-muted">No responses yet on this inject.</p>
              ) : (
                data.answers
                  .filter((a) => a.injectId === data.currentInject?.id)
                  .map((a) => (
                    <AnswerScoreCard
                      key={`${a.id}-${a.pointsAwarded}-${a.needsReview}-${a.overrideComment ?? ""}`}
                      answer={a}
                      roleLabel={roleName(a.playbookRoleId)}
                      maxPoints={maxPointsForRoleQuestions(
                        data.currentInject?.questions ?? [],
                        a.playbookRoleId,
                      )}
                      canOverride={data.canManage}
                      sessionId={sessionId}
                      busy={busy}
                      onSaved={() => void load()}
                      setBusy={setBusy}
                      setError={setError}
                    />
                  ))
              )}
            </div>
          </FlashCard>
        ) : null}
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </div>
      </div>

      <aside
        className={cn(
          "flex min-h-0 min-w-0 flex-col lg:h-full lg:overflow-hidden",
          data.canManage ? "max-lg:min-h-[min(70dvh,36rem)]" : "max-lg:min-h-0",
        )}
      >
        <FlashCard className="glass-dock min-h-0 flex-1">
          {data.canManage ? (
            <div
              className="grid shrink-0 grid-cols-3 gap-1 border-b border-border-soft p-2"
              role="tablist"
              aria-label="Session operations"
            >
              {(
                [
                  ["squad", `Squad ${data.seats.length}`],
                  ["invites", "Invites"],
                  ["teams", `Teams ${data.teams.length}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={dockTab === id}
                  onClick={() => setDockTab(id)}
                  className={`glass-row rounded-[var(--radius-control)] px-2 py-2 text-[11px] font-semibold ${
                    dockTab === id ? "text-primary-hover" : "text-muted hover:text-fg"
                  }`}
                  data-active={dockTab === id ? "true" : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {!data.canManage || dockTab === "squad" ? (
              <div className="flex flex-col gap-2.5">
                <div className="glass-header -mx-3 -mt-3 flex items-center justify-between px-3 py-2">
                  <h2 className="text-[15px] font-semibold">Squad roster</h2>
                  <span className="text-[11px] text-meta">
                    {data.seats.filter((s) => s.presence === "online").length}/
                    {data.seats.length} online
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {data.seats.length === 0 ? (
                    <li className="glass-inset rounded-[var(--radius-control)] px-3 py-2.5 text-[13px] text-muted">
                      No one seated yet.
                    </li>
                  ) : (
                    data.seats.map((seat) => {
                      const answered = data.answers.some(
                        (a) =>
                          a.userId === seat.user.id &&
                          a.injectId === data.currentInject?.id,
                      );
                      const pending = data.completion?.pendingUserIds?.includes(
                        seat.user.id,
                      );
                      const seatTeam = teamName(seat.teamId);
                      const presence = seat.presence ?? "waiting";
                      return (
                        <li
                          key={seat.id}
                          className="glass-row flex items-start justify-between gap-2 rounded-[var(--radius-control)] px-2 py-2"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[12px] font-bold text-primary-hover">
                              {initials(seat.user.name)}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                                  presence === "online"
                                    ? "bg-success"
                                    : presence === "left"
                                      ? "bg-danger/70"
                                      : "bg-border"
                                }`}
                                title={
                                  presence === "online"
                                    ? "Online"
                                    : presence === "left"
                                      ? "Left"
                                      : "Yet to join"
                                }
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium">
                                {seat.user.name}
                              </div>
                              <div className="line-clamp-2 text-[11px] text-meta">
                                {seatLabel(seat.kind)}
                                {seat.playbookRoleId
                                  ? ` · ${roleName(seat.playbookRoleId)}`
                                  : ""}
                                {seatTeam ? ` · ${seatTeam}` : ""}
                              </div>
                              {seat.kind === "PARTICIPANT" ||
                              seat.playbookRoleId ? (
                                <div className="mt-0.5">
                                  <PresenceBadge status={presence} />
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {live && seat.kind === "PARTICIPANT" ? (
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  answered
                                    ? "bg-success"
                                    : pending
                                      ? "bg-primary"
                                      : "bg-border"
                                }`}
                                title={
                                  answered
                                    ? "Responded"
                                    : pending
                                      ? "Pending answer"
                                      : "No answer yet"
                                }
                              />
                            ) : null}
                            {data.canManage ? (
                              <button
                                type="button"
                                className="text-[11px] text-muted hover:text-danger"
                                onClick={async () => {
                                  await fetch(
                                    `/api/sessions/${sessionId}/seats?seatId=${seat.id}`,
                                    { method: "DELETE" },
                                  );
                                  await load();
                                }}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
                {data.canManage ? <SeatForm data={data} onDone={load} /> : null}
              </div>
            ) : null}

            {data.canManage && dockTab === "invites" ? (
              <RoleInvitePanel sessionId={sessionId} onChanged={load} embedded />
            ) : null}

            {data.canManage && dockTab === "teams" ? (
              <TeamPanel
                sessionId={sessionId}
                teams={data.teams}
                seats={data.seats}
                roles={data.roles}
                onDone={load}
                embedded
              />
            ) : null}
          </div>
        </FlashCard>
      </aside>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function SeatForm({ data, onDone }: { data: Payload; onDone: () => Promise<void> }) {
  const [kind, setKind] = useState("PARTICIPANT");
  const [error, setError] = useState<string | null>(null);
  const seated = new Set(data.seats.map((s) => s.user.id));
  const takenRoles = new Set(
    data.seats
      .filter((s) => s.kind === "PARTICIPANT" && s.playbookRoleId)
      .map((s) => s.playbookRoleId as string),
  );
  const availableRoles = data.roles.filter((role) => !takenRoles.has(role.id));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    const response = await fetch(`/api/sessions/${data.id}/seats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(formData.get("userId") ?? ""),
        kind: String(formData.get("kind") ?? "PARTICIPANT"),
        playbookRoleId: String(formData.get("playbookRoleId") ?? "") || null,
        teamId: String(formData.get("teamId") ?? "") || null,
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Could not seat");
      return;
    }
    form.reset();
    setKind("PARTICIPANT");
    await onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-1 flex flex-col gap-2.5 border-t border-border-soft pt-3"
    >
      <h2 className="text-[15px] font-semibold">Add to squad</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Person</span>
        <select name="userId" required className="field">
          {data.people
            .filter((p) => !seated.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.email})
                {p.canFacilitate ? " · facilitator" : ""}
                {p.organization ? ` · ${p.organization.name}` : ""}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Run role</span>
        <select
          name="kind"
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="MODERATOR">Facilitator</option>
          <option value="OBSERVER">Observer</option>
          <option value="PARTICIPANT">Participant</option>
        </select>
      </label>
      {kind === "PARTICIPANT" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">
              Playbook role (optional)
            </span>
            <select name="playbookRoleId" className="field" defaultValue="">
              <option value="">Squad member — no specific role</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {data.teams.length > 0 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">Team</span>
              <select name="teamId" className="field" defaultValue="">
                <option value="">Not onboarded yet</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary"
      >
        Seat player
      </button>
    </form>
  );
}

function AnswerScoreCard({
  answer,
  roleLabel,
  maxPoints,
  canOverride,
  sessionId,
  busy,
  onSaved,
  setBusy,
  setError,
}: {
  answer: Answer;
  roleLabel: string;
  maxPoints: number;
  canOverride: boolean;
  sessionId: string;
  busy: boolean;
  onSaved: () => void;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [points, setPoints] = useState(String(answer.pointsAwarded ?? answer.autoPoints ?? 0));
  const [comment, setComment] = useState(answer.overrideComment ?? "");

  async function saveOverride() {
    const awarded = Number(points);
    const capError = overrideScoreError(
      Number.isFinite(awarded) ? awarded : NaN,
      maxPoints,
    );
    if (capError) {
      setError(capError);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/sessions/${sessionId}/answers/${answer.id}/score`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsAwarded: awarded,
          overrideComment: comment.trim() || undefined,
        }),
      },
    );
    setBusy(false);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not save score");
      return;
    }
    onSaved();
  }

  return (
    <div className="glass-inset flex flex-col rounded-[var(--radius-control)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-medium text-muted">
          {answer.userName} · {roleLabel}
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-primary">
          {answer.needsReview ? (
            <span className="chip chip-on text-warn">Needs review</span>
          ) : (
            <>
              {answer.pointsAwarded ?? answer.autoPoints ?? 0} pts
              {typeof answer.autoPoints === "number" &&
              answer.pointsAwarded !== answer.autoPoints
                ? ` (auto ${answer.autoPoints})`
                : null}
            </>
          )}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[14px]">{answer.body}</p>
      {answer.aiNotes ? (
        <p className="glass-tile mt-2 px-3 py-2 text-[12px] text-fg-2">
          <span className="font-semibold text-meta">AI notes · </span>
          {answer.aiNotes}
        </p>
      ) : null}
      {canOverride ? (
        <div className="mt-auto flex flex-col gap-2 border-t border-border-soft pt-3 sm:flex-row sm:items-end">
          <label className="flex min-w-[5rem] flex-col gap-1 text-[11px] font-semibold text-meta">
            Points
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={maxPoints}
                className="field h-9 w-20"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <span className="font-mono text-[11px] font-medium tabular-nums text-meta">
                / {maxPoints}
              </span>
            </span>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold text-meta">
            {answer.needsReview ? "Review note" : "Override comment"}
            <input
              className="field h-9"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                answer.needsReview
                  ? "Required context for the score"
                  : "Optional facilitator note"
              }
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveOverride()}
            className="btn btn-ghost h-9 shrink-0"
          >
            {answer.needsReview ? "Mark score" : "Save score"}
          </button>
        </div>
      ) : answer.overrideComment ? (
        <p className="mt-2 text-[12px] text-muted">
          Facilitator: {answer.overrideComment}
        </p>
      ) : null}
    </div>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <path d="M12 2L4 5v6c0 5.25 3.75 9 8 10 4.25-1 8-4.75 8-10V5l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function StandbyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
