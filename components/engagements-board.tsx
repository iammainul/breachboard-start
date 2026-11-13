"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MissionCard } from "@/components/game-ui";
import { EmptyState, SectionHeading, ShieldIcon } from "@/components/ui-kit";
import { formatDateTime, cn } from "@/lib/cn";

export type EngagementRow = {
  id: string;
  status: string;
  joinCode: string;
  createdAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  closedAt: string | null;
  reportGeneratedAt: string | null;
  organizationName: string;
  exerciseTitle: string;
  seatCount: number;
  answerCount: number;
};

type TabId = "active" | "closed" | "archived";

const TABS: { id: TabId; label: string; hint: string }[] = [
  {
    id: "active",
    label: "Active",
    hint: "Prep and live rooms for this client",
  },
  {
    id: "closed",
    label: "Closed",
    hint: "Finished engagements — archive when done reviewing",
  },
  {
    id: "archived",
    label: "Archived",
    hint: "Hidden from day-to-day ops; restore anytime",
  },
];

function tabForStatus(status: string): TabId {
  if (status === "archived") return "archived";
  if (status === "closed") return "closed";
  return "active";
}

function runMeta(session: EngagementRow) {
  const parts = [
    `${session.seatCount} seated`,
    `${session.answerCount} answers`,
    `Created ${formatDateTime(session.createdAt)}`,
  ];
  if (session.scheduledAt) {
    parts.push(`Scheduled ${formatDateTime(session.scheduledAt)}`);
  }
  if (session.startedAt) {
    parts.push(`Executed ${formatDateTime(session.startedAt)}`);
  }
  if (session.closedAt) {
    parts.push(`Closed ${formatDateTime(session.closedAt)}`);
  }
  return parts.join(" · ");
}

export function EngagementsBoard({
  sessions,
  clientName,
}: {
  sessions: EngagementRow[];
  clientName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const next = { active: 0, closed: 0, archived: 0 };
    for (const session of sessions) {
      next[tabForStatus(session.status)] += 1;
    }
    return next;
  }, [sessions]);

  const visible = useMemo(
    () => sessions.filter((session) => tabForStatus(session.status) === tab),
    [sessions, tab],
  );

  async function setStatus(sessionId: string, status: "closed" | "archived") {
    setBusyId(sessionId);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not update engagement");
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <div
        className="engagement-tabs flash-card grid grid-cols-3 gap-1 p-1"
        role="tablist"
        aria-label="Engagement status"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-tab={item.id}
              aria-selected={selected}
              aria-controls="engagement-panel"
              id={`engagement-tab-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "engagement-tab glass-row rounded-[var(--radius-control)] px-3 py-2 text-left",
                selected ? "" : "text-muted hover:text-fg",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{item.label}</span>
                <span className="tab-count font-mono text-[11px] text-meta">
                  {counts[item.id]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <SectionHeading
        title={`${TABS.find((t) => t.id === tab)?.label} engagements`}
        description={`${clientName} — ${TABS.find((t) => t.id === tab)?.hint}`}
      />

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <div
        id="engagement-panel"
        role="tabpanel"
        aria-labelledby={`engagement-tab-${tab}`}
      >
      {visible.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon className="h-7 w-7" />}
          title={`No ${tab} engagements`}
          description={
            tab === "active"
              ? "Launch an engagement above once a scenario is ready."
              : tab === "closed"
                ? "Ended runs land here. Archive them when you’re finished reviewing."
                : "Archive closed engagements to keep Active and Closed lists tidy."
          }
        />
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {visible.map((session) => (
            <li key={session.id} className="flex flex-col gap-1.5">
              <MissionCard
                href={`/sessions/${session.id}`}
                title={session.exerciseTitle}
                org={session.organizationName}
                meta={runMeta(session)}
                status={session.status}
                joinCode={session.joinCode}
              />
              <div className="flex flex-wrap gap-1.5 px-1">
                {tab === "closed" || tab === "archived" ? (
                  <a
                    href={`/sessions/${session.id}/report`}
                    className="btn btn-ghost h-8 px-3 text-[12px]"
                  >
                    {session.reportGeneratedAt ? "Open report" : "Generate report"}
                  </a>
                ) : null}
                {tab === "closed" ? (
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-3 text-[12px] disabled:opacity-50"
                    disabled={busyId === session.id}
                    onClick={() => void setStatus(session.id, "archived")}
                  >
                    {busyId === session.id ? "Archiving…" : "Archive"}
                  </button>
                ) : null}
                {tab === "archived" ? (
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-3 text-[12px] disabled:opacity-50"
                    disabled={busyId === session.id}
                    onClick={() => void setStatus(session.id, "closed")}
                  >
                    {busyId === session.id ? "Restoring…" : "Restore to Closed"}
                  </button>
                ) : null}
                {tab === "active" && session.status === "live" ? (
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-3 text-[12px] text-danger disabled:opacity-50"
                    disabled={busyId === session.id}
                    onClick={() => void setStatus(session.id, "closed")}
                  >
                    {busyId === session.id ? "Ending…" : "End engagement"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </section>
  );
}
