import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { ReportGenerateButton } from "@/components/report-generate-button";
import { DataTable, EmptyState, PageHero, SectionHeading } from "@/components/ui-kit";
import { assertPageSessionAccess, isAdmin, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/cn";
import {
  buildSessionReport,
  type SessionReportSnapshot,
} from "@/lib/session-report";

function asSnapshot(value: unknown): SessionReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.leaderboard) || !Array.isArray(rec.answers)) return null;
  return value as SessionReportSnapshot;
}

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  assertPageSessionAccess(user, id);
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      joinCode: true,
      reportSnapshot: true,
      reportGeneratedAt: true,
      seats: { select: { userId: true } },
    },
  });
  if (!session) notFound();
  const seated = session.seats.some((s) => s.userId === user.id);
  if (!seated && !isAdmin(user)) notFound();

  const stored = asSnapshot(session.reportSnapshot);
  const snapshot = stored ?? (await buildSessionReport(id));
  if (!snapshot) notFound();

  const storedAt = session.reportGeneratedAt
    ? formatDateTime(session.reportGeneratedAt.toISOString())
    : null;

  return (
    <DeskShell>
      <PageFrame className="h-full flex-1 overflow-hidden">
        <div className="shrink-0">
          <PageHero
            variant="admin"
            eyebrow="After-action"
            title={snapshot.exercise.title}
            description={`${snapshot.organization.name} · ${snapshot.joinCode} · ${
              stored
                ? `Stored ${storedAt ?? "report"}`
                : "Live preview — generate to store this run"
            }`}
            actions={
              <>
                <Link href={`/sessions/${id}`} className="btn btn-ghost">
                  Back to run
                </Link>
                {isAdmin(user) ? <ReportGenerateButton sessionId={id} /> : null}
              </>
            }
          />
        </div>

        <div className="glass-scroll -mr-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-1 pr-1">
          <section className="flex flex-col gap-2.5">
            <SectionHeading
              title="Leaderboard"
              description={`${snapshot.leaderboard.length} participants`}
            />
            <DataTable
              columns={["Name", "Role", "Score", "Rank"]}
              columnWidths={[undefined, "160px", "120px", "100px"]}
              rows={snapshot.leaderboard.map((row) => [
                row.name,
                row.role,
                `${row.earned} / ${row.total}`,
                row.rank,
              ])}
              empty={
                <EmptyState
                  title="No seated participants"
                  description="Scores appear once players join and answer injects."
                />
              }
            />
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeading
              title="Inject answers"
              description="AI notes and facilitator overrides from this run."
            />
            {snapshot.answers.length === 0 ? (
              <EmptyState
                title="No answers recorded"
                description="Participant responses are stored here when the run closes."
              />
            ) : (
              <ul className="grid gap-2.5 xl:grid-cols-2">
                {snapshot.answers.map((answer, index) => (
                  <li
                    key={`${answer.injectId}-${answer.userName}-${index}`}
                    className="flash-card glass-reading flex flex-col px-5 py-3.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[15px] font-semibold text-fg">
                        {answer.injectTitle}
                      </h3>
                      <span className="font-mono text-[12px] text-meta">
                        {answer.needsReview
                          ? "Needs review"
                          : `${answer.pointsAwarded} pts${
                              answer.autoPoints !== answer.pointsAwarded
                                ? ` (AI ${answer.autoPoints})`
                                : ""
                            }`}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {answer.userName} · {answer.role}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-fg-2">
                      {answer.body}
                    </p>
                    {answer.aiNotes ? (
                      <p className="glass-inset mt-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] leading-relaxed text-muted">
                        AI: {answer.aiNotes}
                      </p>
                    ) : null}
                    {answer.overrideComment ? (
                      <p className="glass-inset mt-2 rounded-[var(--radius-control)] px-3 py-2 text-[13px] text-warn">
                        Override: {answer.overrideComment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageFrame>
    </DeskShell>
  );
}
