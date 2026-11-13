"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MissionCard } from "@/components/game-ui";
import { EmptyState, SectionHeading, ShieldIcon } from "@/components/ui-kit";
import { formatDateTime } from "@/lib/cn";

export type DraftRunRow = {
  id: string;
  status: string;
  joinCode: string;
  createdAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  organizationName: string;
  exerciseTitle: string;
  seatCount: number;
};

function runMeta(session: DraftRunRow) {
  return [
    `${session.seatCount} seated`,
    `Created ${formatDateTime(session.createdAt)}`,
    session.scheduledAt ? `Scheduled ${formatDateTime(session.scheduledAt)}` : null,
    session.startedAt ? `Executed ${formatDateTime(session.startedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DraftRunsBoard({
  sessions,
  clientName,
}: {
  sessions: DraftRunRow[];
  clientName: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(session: DraftRunRow) {
    if (
      !window.confirm(
        `Delete this draft run of “${session.exerciseTitle}”? Join code, seats, and answers are removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(session.id);
    setError(null);
    const response = await fetch(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not delete draft run");
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        title="Draft rooms"
        description={`${sessions.length} for ${clientName}`}
      />
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      {sessions.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon className="h-7 w-7" />}
          title="No draft runs"
          description="Open a draft to rehearse injects without seating every role."
        />
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {sessions.map((session) => (
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
                <button
                  type="button"
                  className="btn btn-ghost h-8 px-3 text-[12px] text-danger disabled:opacity-50"
                  disabled={busyId === session.id}
                  onClick={() => void remove(session)}
                >
                  {busyId === session.id ? "Deleting…" : "Delete draft"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
