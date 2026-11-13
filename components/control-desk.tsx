import Link from "next/link";
import { CyberNewsRail } from "@/components/cyber-news-rail";
import { StageMedia } from "@/components/stage-media";
import { EmptyState, ShieldIcon } from "@/components/ui-kit";
import { StatusBadge } from "@/components/game-ui";
import type { HubNewsItem } from "@/lib/intel/news-feeds";

type EngagementRow = {
  id: string;
  status: string;
  joinCode: string;
  createdAt: Date;
  startedAt: Date | null;
  organization: { name: string };
  exercise: { title: string };
  imageSrc: string | null;
  seats: number;
  answers: number;
};

export function ControlDesk({
  orgName,
  liveEngagements,
  engagementSeated,
  answerCount,
  draftLive,
  orgCount,
  userCount,
  scenarioCount,
  ongoing,
  newsItems,
}: {
  orgName: string | null;
  liveEngagements: number;
  engagementSeated: number;
  answerCount: number;
  draftLive: number;
  orgCount: number;
  userCount: number;
  scenarioCount: number;
  ongoing: EngagementRow[];
  newsItems: HubNewsItem[];
}) {
  const featured = ongoing[0] ?? null;
  const rest = ongoing.slice(1);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            Desk
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">Control</h1>
          <p className="mt-1 max-w-xl text-[14px] text-muted">
            {orgName
              ? `${orgName} — open the live room, then generate or draft when you need a new pack.`
              : "Pick a working organization in the sidebar to scope this desk."}
          </p>
        </div>
        <Link
          href="/sessions/engagements"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          All engagements
        </Link>
      </header>

      <dl className="flash-card grid grid-cols-2 overflow-hidden sm:grid-cols-4">
        <Metric
          label="Live"
          value={liveEngagements}
          hint="Facilitated rooms"
          accent={liveEngagements > 0}
        />
        <Metric label="Seated" value={engagementSeated} hint="In live rooms" />
        <Metric label="Answers" value={answerCount} hint="This pulse" />
        <Metric
          label="Rehearsals"
          value={draftLive}
          hint={`${scenarioCount} packs · ${orgCount} orgs · ${userCount} operators`}
        />
      </dl>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-meta">
          Now
        </h2>
        {featured ? (
          <FeaturedRoom session={featured} />
        ) : (
          <EmptyState
            icon={<ShieldIcon className="h-7 w-7" />}
            title="No active engagements"
            description="Launch an engagement from an accepted scenario when the roster is ready."
            action={
              <Link href="/sessions/engagements" className="btn btn-primary">
                Open engagements
              </Link>
            }
          />
        )}
        {rest.length > 0 ? (
          <ul className="flash-card divide-y divide-border-soft overflow-hidden">
            {rest.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/sessions/${session.id}`}
                  className="glass-row flex items-center gap-3 px-4 py-2.5"
                >
                  {session.imageSrc ? (
                    <div className="glass-tile hidden h-11 w-[72px] shrink-0 overflow-hidden sm:block">
                      <StageMedia
                        src={session.imageSrc}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{session.exercise.title}</p>
                    <p className="truncate text-[12px] text-muted">
                      {session.organization.name} · {session.seats} seated ·{" "}
                      <span className="font-mono tracking-[0.12em]">{session.joinCode}</span>
                    </p>
                  </div>
                  <StatusBadge status={session.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <CyberNewsRail items={newsItems} canGenerate layout="headlines" />
    </div>
  );
}

function FeaturedRoom({ session }: { session: EngagementRow }) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flash-card group flex flex-col overflow-hidden sm:flex-row sm:items-stretch"
    >
      {session.imageSrc ? (
        <div className="aspect-[16/9] w-full shrink-0 overflow-hidden bg-bg sm:aspect-auto sm:h-auto sm:w-[260px]">
          <StageMedia
            src={session.imageSrc}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold tracking-tight">{session.exercise.title}</p>
          <p className="mt-1 text-[13px] text-muted">
            {session.organization.name}
            {" · "}
            <span className="font-mono text-[12px] font-semibold tracking-[0.12em] text-primary-hover">
              {session.joinCode}
            </span>
            {` · ${session.seats} seated · ${session.answers} answers`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} />
          <span className="btn btn-primary">Open room</span>
        </div>
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="border-border-soft px-5 py-4 sm:border-r sm:last:border-r-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-meta">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[28px] font-bold tabular-nums ${accent ? "text-primary" : "text-fg"}`}
      >
        {value}
      </dd>
      <p className="mt-0.5 text-[12px] text-muted">{hint}</p>
    </div>
  );
}
