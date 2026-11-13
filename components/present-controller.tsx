"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DISCUSS_TIMER_CAPTION,
  DISCUSS_TIMER_LABEL,
  InjectCountdown,
  JoinCodeBadge,
  PresenceBadge,
  StatusBadge,
} from "@/components/game-ui";
import { InjectMediaList } from "@/components/inject-media";
import { openStageWindow } from "@/lib/open-stage-window";
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
  expectedAction?: string;
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
type Seat = {
  id: string;
  kind: string;
  playbookRoleId: string | null;
  user: { id: string; name: string; email: string };
  presence?: "online" | "waiting" | "left";
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
  exercise: { title: string; durationMin: number };
  exerciseRevision?: string;
  roles: Role[];
  teams: Team[];
  injects: Inject[];
  currentInject: Inject | null;
  seats?: Seat[];
  answers: Answer[];
  canManage: boolean;
  completion: {
    answered: number;
    expected: number;
    pending?: { userId: string; name: string; roleId: string | null }[];
    answeredPeople?: { userId: string; name: string; roleId: string | null }[];
  } | null;
};

export function PresentController({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const lastInjectId = useRef<string | null>(null);

  const poll = useSessionPollIntervals();
  const { data, error, setError, reload } = usePollingResource<Payload>({
    url: `/api/sessions/${sessionId}`,
    intervalMs: poll.visibleMs,
    hiddenIntervalMs: poll.hiddenMs,
    merge: mergeSessionPollPayload,
    needsFullReload: sessionNeedsFullReload,
  });

  useEffect(() => {
    if (!data?.currentInjectId) return;
    if (
      lastInjectId.current &&
      lastInjectId.current !== data.currentInjectId
    ) {
      setToast("Inject updated (multi-controller sync)");
      window.setTimeout(() => setToast(null), 4000);
    }
    lastInjectId.current = data.currentInjectId;
  }, [data?.currentInjectId]);

  async function load() {
    await reload();
  }

  useEffect(() => {
    // Open Stage once when entering Present (controller stays on this page).
    const key = `ttx-stage-opened:${sessionId}`;
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    void openStageWindow(sessionId);
  }, [sessionId]);

  const roleName = useMemo(() => {
    const map = new Map((data?.roles ?? []).map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? id : "—");
  }, [data?.roles]);

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
      setError(json.error ?? "Update failed");
      return;
    }
    await load();
  }

  if (!data) {
    return (
      <div className="flex h-dvh min-h-0 items-center justify-center p-6">
        <p className="flash-card px-5 py-3.5 text-[14px] text-muted">
          {error ?? "Loading controller…"}
        </p>
      </div>
    );
  }

  if (!data.canManage) {
    return (
      <div className="flex h-dvh min-h-0 items-center justify-center p-6">
        <div className="flash-card w-full max-w-lg px-6 py-8 text-center">
          <p className="text-[16px] font-semibold">Facilitator seat required</p>
          <p className="mt-1.5 text-[14px] text-muted">
            Present mode is for seated facilitators only.
          </p>
          <Link href={`/sessions/${sessionId}`} className="btn btn-primary mt-4 inline-flex">
            Back to session
          </Link>
        </div>
      </div>
    );
  }

  const live = data.status === "live";
  const inject = data.currentInject;
  const hasMedia = Boolean(inject?.mediaPrompts?.some((m) => m.assetPath));
  const activeTeamLabel = (() => {
    if (!inject || data.teams.length === 0) return "All teams";
    const active = resolveActiveTeamIds(inject, data.teams);
    if (active === "all") return "All teams";
    return active
      .map((id) => data.teams.find((t) => t.id === id)?.name ?? id)
      .join(" · ");
  })();

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden text-fg">
      <header className="glass-header flex shrink-0 items-center gap-3 px-3 py-2 sm:px-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-fg">
              Present
            </span>
            <StatusBadge status={data.status} />
            <span className="chip chip-on capitalize">{data.phase}</span>
            <span className="truncate font-mono text-[11px] text-meta">
              {data.organization.name}
            </span>
            <span className="truncate text-[13px] font-semibold">
              {data.exercise.title}
            </span>
            {toast ? (
              <span className="truncate text-[12px] text-primary-hover">{toast}</span>
            ) : null}
          </div>
        </div>
        {inject && live && data.phase === "discuss" ? (
          <InjectCountdown
            seconds={data.discussSeconds ?? 120}
            injectId={`${inject.id}-discuss`}
            active
            startedAt={data.currentInjectStartedAt}
            label={DISCUSS_TIMER_LABEL}
            caption={DISCUSS_TIMER_CAPTION}
            onExpired={() => void reload()}
          />
        ) : null}
        {inject && live && data.phase === "answering" ? (
          <InjectCountdown
            seconds={inject.timerSeconds}
            injectId={inject.id}
            active
            startedAt={data.currentInjectStartedAt}
          />
        ) : null}
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void openStageWindow(sessionId)}
          >
            Open Stage
          </button>
          <Link
            href={`/sessions/${sessionId}`}
            className="btn btn-ghost"
            onClick={() => {
              try {
                sessionStorage.removeItem(`ttx-stage-opened:${sessionId}`);
              } catch {
                /* ignore */
              }
            }}
          >
            Exit Present
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 max-lg:auto-rows-min max-lg:overflow-y-auto lg:grid-cols-[minmax(200px,228px)_minmax(0,1fr)_minmax(248px,292px)]">
        <aside className="flex min-h-0 flex-col lg:h-full lg:overflow-hidden">
          <section className="flash-card glass-dock flex min-h-0 flex-1 flex-col max-lg:min-h-[16rem]">
            <div className="glass-header flex shrink-0 items-start justify-between gap-2 px-3 py-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                Inject map
              </h2>
              <p className="min-w-0 truncate text-[11px] text-fg-2" title={activeTeamLabel}>
                In play · {activeTeamLabel}
              </p>
            </div>
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              <ol className="flex flex-col gap-0.5">
                {data.injects.map((item) => {
                  const active = item.id === data.currentInjectId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patch({ currentInjectId: item.id })}
                        data-active={active ? "true" : undefined}
                        className={`glass-row flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[13px] ${
                          active
                            ? "font-semibold text-primary-hover"
                            : "text-muted"
                        }`}
                      >
                        <span className="font-mono text-[11px]">
                          {String(item.sequence).padStart(2, "0")}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </aside>

        <main className="flex min-h-0 flex-col gap-2 lg:h-full lg:overflow-hidden">
          <section className="flash-card glass-chrome shrink-0 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-meta">
                  {inject
                    ? `INJ-${String(inject.sequence).padStart(2, "0")}`
                    : "Standby"}
                </p>
                <h2 className="truncate text-[16px] font-bold tracking-tight">
                  {inject?.title ?? "No inject released"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.status !== "live" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary"
                    onClick={() => void patch({ status: "live" })}
                  >
                    Start / go live
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary"
                    onClick={() => void patch({ currentInjectId: "next" })}
                  >
                    Release next inject
                  </button>
                )}
                {live && data.phase === "discuss" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost"
                    onClick={() => void patch({ phase: "answering" })}
                  >
                    Open questions
                  </button>
                ) : null}
                {live && data.phase !== "debrief" && data.phase !== "discuss" ? (
                  <button
                    type="button"
                    disabled={busy || !inject}
                    className="btn btn-ghost"
                    onClick={() => void patch({ phase: "debrief" })}
                  >
                    Open debrief
                  </button>
                ) : null}
                {data.phase === "debrief" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost"
                    onClick={() => void patch({ phase: "answering" })}
                  >
                    Back to answering
                  </button>
                ) : null}
                {data.status !== "closed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost"
                    onClick={() => void patch({ status: "closed" })}
                  >
                    End exercise
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section
            className={`grid min-h-0 flex-1 gap-2 max-lg:min-h-[18rem] ${
              hasMedia
                ? "xl:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.1fr)]"
                : "grid-cols-1"
            }`}
          >
            {hasMedia ? (
              <div className="flash-card glass-dock min-h-0 overflow-hidden p-2">
                <InjectMediaList items={inject?.mediaPrompts} size="present" />
              </div>
            ) : null}
            <div className="flash-card glass-reading glass-dock min-h-0">
              <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3">
                {inject ? (
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-fg-2">
                    {inject.body}
                  </p>
                ) : (
                  <p className="text-[13px] text-muted">
                    Release an inject to fill this board. Stage mirrors narrative,
                    timer, and completion — answers stay private until debrief.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="flash-card flex shrink-0 items-stretch gap-2 px-3 py-2">
            <label className="sr-only" htmlFor="present-notes">
              Private notes
            </label>
            <span className="shrink-0 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-meta">
              Notes
            </span>
            <textarea
              id="present-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="field min-h-0 flex-1 resize-none py-1.5 text-[13px]"
              placeholder="Facilitator scratchpad — not synced, not on Stage"
            />
          </section>
        </main>

        <aside className="flex min-h-0 flex-col gap-2 max-lg:min-h-[22rem] lg:h-full lg:overflow-hidden">
          <div className="shrink-0">
            <JoinCodeBadge
              code={data.joinCode}
              size="compact"
              hint="Scan to join this squad — name only, no account."
            />
          </div>
          <section className="flash-card glass-dock min-h-0 flex-1">
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
              <section className="glass-tile px-3 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                  Completion
                </h2>
                <p className="mt-1 text-[22px] font-bold leading-none tabular-nums">
                  {data.completion?.answered ?? 0}
                  <span className="text-[14px] font-medium text-muted">
                    {" "}
                    / {data.completion?.expected ?? 0}
                  </span>
                </p>
                <div className="progress-track mt-2">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        data.completion && data.completion.expected > 0
                          ? (data.completion.answered / data.completion.expected) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </section>

              <section className="mt-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                  Squad presence
                </h2>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {(data.seats ?? []).filter((s) => s.kind === "PARTICIPANT")
                    .length === 0 ? (
                    <li className="text-[13px] text-muted">No participants seated</li>
                  ) : (
                    (data.seats ?? [])
                      .filter((s) => s.kind === "PARTICIPANT")
                      .map((seat) => (
                        <li
                          key={seat.id}
                          className="glass-row flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-[13px]"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{seat.user.name}</div>
                            <div className="truncate text-[11px] text-meta">
                              {roleName(seat.playbookRoleId)}
                            </div>
                          </div>
                          <PresenceBadge status={seat.presence ?? "waiting"} />
                        </li>
                      ))
                  )}
                </ul>
              </section>

              <section className="mt-2.5 border-t border-border-soft pt-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                  Answered
                </h2>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {(data.completion?.answeredPeople ?? []).length === 0 ? (
                    <li className="text-[13px] text-muted">None yet</li>
                  ) : (
                    data.completion!.answeredPeople!.map((p) => (
                      <li key={p.userId} className="text-[13px]">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-meta"> · {roleName(p.roleId)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="mt-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                  Pending
                </h2>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {(data.completion?.pending ?? []).length === 0 ? (
                    <li className="text-[13px] text-muted">Caught up</li>
                  ) : (
                    data.completion!.pending!.map((p) => (
                      <li key={p.userId} className="text-[13px]">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-meta"> · {roleName(p.roleId)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {data.phase === "debrief" && inject ? (
                <section className="mt-2.5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                    Debrief responses
                  </h2>
                  <div className="mt-1.5 flex flex-col gap-2">
                    {data.answers
                      .filter((a) => a.injectId === inject.id)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="glass-inset rounded-[var(--radius-control)] px-3 py-2"
                        >
                          <div className="text-[11px] text-meta">
                            {a.userName} · {roleName(a.playbookRoleId)}
                            {a.needsReview ? " · needs review" : ""}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-[13px]">{a.body}</p>
                        </div>
                      ))}
                  </div>
                  <div className="mt-2.5">
                    <DebriefHighlights
                      compact
                      answers={data.answers.filter((a) => a.injectId === inject.id)}
                      questions={inject.questions ?? []}
                      roleName={roleName}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
      {error ? (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-[var(--radius-control)] bg-danger px-4 py-2 text-[13px] text-white shadow-lg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
