import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { assertPageSessionAccess, isAdmin, requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const SessionConsole = dynamic(
  () =>
    import("@/components/session-console").then((m) => m.SessionConsole),
  {
    loading: () => (
      <div className="flash-card flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[14px] text-muted">Loading exercise…</p>
      </div>
    ),
  },
);

export default async function SessionPage({
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
      seats: { select: { userId: true } },
    },
  });
  if (!session) notFound();
  const seated = session.seats.some((s) => s.userId === user.id);
  if (!seated && !isAdmin(user)) notFound();

  return (
    <DeskShell>
      <PageFrame className="max-w-[1680px] h-full min-h-0 flex-1 gap-0 overflow-hidden">
        <SessionConsole sessionId={id} />
      </PageFrame>
    </DeskShell>
  );
}
