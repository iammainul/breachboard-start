"use client";

import { useMemo } from "react";
import {
  DISCUSS_TIMER_CAPTION,
  DISCUSS_TIMER_LABEL,
  InjectCountdown,
  JoinCodeBadge,
  TechniqueChip,
} from "@/components/game-ui";
import { InjectMediaList } from "@/components/inject-media";
import { resolveActiveTeamIds } from "@/lib/participation";
import { mergeSessionPollPayload, sessionNeedsFullReload } from "@/lib/merge-session-poll";
import { usePollingResource } from "@/lib/use-polling-resource";
import { useSessionPollIntervals } from "@/lib/use-session-poll-intervals";
import { DebriefHighlights } from "@/components/debrief-highlights";

type Role = { id: string; name: string };
type Question = {
  roleId: string;
  roleIds?: string[];
  common?: boolean;
  prompt: string;
  points: number;
};
type Inject = {
  id: string;
  sequence: number;
  title: string;
  body: string;
  timerSeconds: number;
  techniqueIds?: string[];
  activeTeamIds?: string[];
  /** Facilitator payloads include questions; tolerate participant-shaped stubs. */
  questions?: Question[];
  mediaPrompts?: {
    kind: "image" | "video";
    prompt: string;
    aspect?: string;
    durationSec?: number;
    assetPath?: string;
    source?: "generated" | "fallback" | "upload";
    error?: string;
  }[];
};
type Team = { id: string; name: string; memberUserIds: string[] };
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
type Payload = {
  id: string;
  joinCode: string;
  status: string;
  runKind?: string;
  phase: string;
  discussSeconds?: number;
  currentInjectId: string | null;
  currentInjectStartedAt: string | null;
  organization: { name: string };
  exercise: { title: string };
  exerciseRevision?: string;
  roles: Role[];
  teams: Team[];
  injects?: Inject[];
  currentInject: Inject | null;
  answers: Answer[];
  canManage: boolean;
  completion: { answered: number; expected: number } | null;
};

export function StageView({ sessionId }: { sessionId: string }) {
  const poll = useSessionPollIntervals();
  const { data, error, reload } = usePollingResource<Payload>({
    url: `/api/sessions/${sessionId}`,
    intervalMs: poll.visibleMs,
    hiddenIntervalMs: poll.hiddenMs,
    merge: mergeSessionPollPayload,
    needsFullReload: sessionNeedsFullReload,
  });

  const roleName = useMemo(() => {
    const map = new Map((data?.roles ?? []).map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? id : "—");
  }, [data?.roles]);

  if (error && !data) {
    return (
      <div className="flex h-dvh min-h-0 items-center justify-center px-8 text-center">
        <p className="flash-card px-6 py-5 text-[18px] text-danger">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-dvh min-h-0 items-center justify-center px-8 text-center">
        <p className="flash-card px-6 py-5 text-[18px] text-muted">
          Connecting Stage…
        </p>
      </div>
    );
  }

  if (!data.canManage) {
    return (
      <div className="flex h-dvh min-h-0 items-center justify-center px-8 text-center">
        <p className="flash-card px-6 py-5 text-[20px] font-semibold">
          Stage requires a facilitator login
        </p>
      </div>
    );
  }

  const inject = data.currentInject;
  const debrief = data.phase === "debrief";
  const live = data.status === "live";
  const answered = data.completion?.answered ?? 0;
  const expected = data.completion?.expected ?? 0;
  const pct = expected > 0 ? Math.round((answered / expected) * 100) : 0;

  const inPlayTeams = (() => {
    if (!inject || data.teams.length === 0) return "All teams";
    const active = resolveActiveTeamIds(inject, data.teams);
    if (active === "all") return "All teams";
    return active
      .map((id) => data.teams.find((t) => t.id === id)?.name ?? id)
      .join(" · ");
  })();

  const inPlayRoles = (() => {
    if (!inject) return "";
    const questions = inject.questions ?? [];
    const ids = new Set<string>();
    for (const q of questions) {
      if (q.common) continue;
      if (q.roleId) ids.add(q.roleId);
      for (const r of q.roleIds ?? []) ids.add(r);
    }
    if (ids.size === 0 && questions.some((q) => q.common)) {
      return "Common objectives";
    }
    return [...ids].map((id) => roleName(id)).join(", ");
  })();

  return (
    <div className="stage-root flex h-dvh min-h-0 flex-col overflow-hidden text-fg">
      <header className="glass-header flex shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-semibold uppercase tracking-[0.1em] text-primary-hover">
              {data.organization.name}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                live
                  ? "bg-primary-wash text-primary-hover"
                  : "bg-hover text-muted"
              }`}
            >
              {live ? (
                <span className="pulse-live h-2 w-2 rounded-full bg-primary" />
              ) : null}
              {debrief ? "Debrief" : live ? "Live" : data.status}
            </span>
            <span className="truncate text-[14px] text-muted">{data.exercise.title}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {inject && live && data.phase === "discuss" ? (
            <div className="flex flex-col items-end gap-0.5">
              <InjectCountdown
                seconds={data.discussSeconds ?? 120}
                injectId={`${inject.id}-discuss`}
                active
                startedAt={data.currentInjectStartedAt}
                large
                label={DISCUSS_TIMER_LABEL}
                caption={DISCUSS_TIMER_CAPTION}
                onExpired={() => void reload()}
              />
            </div>
          ) : null}
          {inject && live && data.phase === "answering" ? (
            <InjectCountdown
              seconds={inject.timerSeconds}
              injectId={inject.id}
              active
              startedAt={data.currentInjectStartedAt}
              large
            />
          ) : null}
          <JoinCodeBadge
            code={data.joinCode}
            size="compact"
            hint="Scan to join this squad"
          />
        </div>
      </header>

      {!inject ? (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-10 text-center">
          <div className="flash-card px-8 py-9">
            <p className="text-[28px] font-bold tracking-tight">Standing by</p>
            <p className="mt-1.5 max-w-lg text-[18px] text-muted">
              Join with the squad code or QR above. Facilitator will release the
              first inject shortly.
            </p>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pb-3 pt-2 sm:px-4">
          <section className="flash-card glass-chrome shrink-0 px-4 py-2.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-bold text-meta">
                  INJ-{String(inject.sequence).padStart(2, "0")}
                </div>
                <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">
                  {inject.title}
                </h1>
              </div>
              <div className="glass-inset flex flex-wrap gap-x-6 gap-y-1 rounded-[var(--radius-control)] px-3 py-2 text-[14px] text-fg-2">
                <div>
                  <span className="text-meta">In play · </span>
                  {inPlayTeams}
                </div>
                {inPlayRoles ? (
                  <div>
                    <span className="text-meta">Roles · </span>
                    {inPlayRoles}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid min-h-0 flex-1 gap-2 overflow-hidden max-xl:auto-rows-min max-xl:overflow-y-auto xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="flash-card glass-reading glass-dock min-h-0 max-xl:min-h-[18rem]">
              <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <InjectMediaList items={inject.mediaPrompts} size="stage" />

                <p className="mt-3 whitespace-pre-wrap text-[20px] leading-relaxed text-fg-2 sm:text-[21px]">
                  {inject.body}
                </p>

                {inject.techniqueIds && inject.techniqueIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inject.techniqueIds.map((id) => (
                      <TechniqueChip key={id} id={id} />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {!debrief ? (
              <aside className="flex min-h-0 flex-col gap-2 xl:h-full xl:overflow-hidden">
                <section className="flash-card glass-dock min-h-0 flex-1 max-xl:min-h-[16rem]">
                  <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                    <h2 className="glass-header px-1 pb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-meta">
                      Objectives
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {(inject.questions ?? []).map((q, idx) => (
                        <li
                          key={`${q.prompt}-${idx}`}
                          className="glass-inset rounded-[var(--radius-control)] px-4 py-3"
                        >
                          <div className="text-[12px] font-semibold text-primary-hover">
                            {q.common
                              ? "Common"
                              : roleName(q.roleId || q.roleIds?.[0])}
                            <span className="ml-2 font-medium text-meta">
                              · {q.points} pts
                            </span>
                          </div>
                          <p className="mt-1 text-[17px] leading-snug">{q.prompt}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="flash-card shrink-0 px-5 py-3">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-meta">
                        Responses in
                      </div>
                      <p className="mt-1 text-[28px] font-bold leading-none tabular-nums">
                        {answered}
                        <span className="text-[18px] font-medium text-muted">
                          {" "}
                          / {expected}
                        </span>
                      </p>
                    </div>
                    <p className="text-[16px] font-semibold text-fg-2">{pct}%</p>
                  </div>
                  <div className="progress-track mt-2.5 h-3">
                    <div className="progress-fill h-3" style={{ width: `${pct}%` }} />
                  </div>
                </section>
              </aside>
            ) : (
              <aside className="flex min-h-0 flex-col gap-2 xl:h-full xl:overflow-hidden">
                <section className="flash-card glass-dock min-h-0 flex-1 max-xl:min-h-[16rem]">
                  <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                    <h2 className="glass-header px-1 pb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-meta">
                      Submitted responses
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {data.answers.filter((a) => a.injectId === inject.id).length ===
                      0 ? (
                        <li className="text-[17px] text-muted">No responses recorded.</li>
                      ) : (
                        data.answers
                          .filter((a) => a.injectId === inject.id)
                          .map((a) => (
                            <li
                              key={a.id}
                              className="glass-inset rounded-[var(--radius-control)] px-4 py-3"
                            >
                              <div className="text-[13px] font-semibold text-primary-hover">
                                {a.userName}
                                <span className="ml-2 font-medium text-meta">
                                  · {roleName(a.playbookRoleId)}
                                </span>
                              </div>
                              <p className="mt-1.5 whitespace-pre-wrap text-[17px] leading-relaxed">
                                {a.body}
                              </p>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>
                </section>

                <DebriefHighlights
                  answers={data.answers.filter((a) => a.injectId === inject.id)}
                  questions={inject.questions ?? []}
                  roleName={roleName}
                />
              </aside>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
