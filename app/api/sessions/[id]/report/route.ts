import { NextResponse } from "next/server";
import { isAdmin, requireApiUserForSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  buildSessionReport,
  persistSessionReport,
  redactSessionReport,
  type SessionReportSnapshot,
} from "@/lib/session-report";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";

async function loadAccessibleSession(
  id: string,
  userId: string,
  admin: boolean,
) {
  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      reportSnapshot: true,
      reportGeneratedAt: true,
      seats: { select: { userId: true, kind: true } },
    },
  });
  if (!session) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const seat = session.seats.find((s) => s.userId === userId);
  if (!seat && !admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, seat, admin };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const loaded = await loadAccessibleSession(id, actor.user.id, isAdmin(actor.user));
  if ("error" in loaded) return loaded.error;

  const raw = loaded.session.reportSnapshot
    ? (loaded.session.reportSnapshot as SessionReportSnapshot)
    : await buildSessionReport(id);
  if (!raw) {
    return NextResponse.json({ snapshot: null, generatedAt: null, stored: false });
  }
  const snapshot = redactSessionReport(raw, {
    userId: actor.user.id,
    seatKind: loaded.seat?.kind,
    isAdmin: loaded.admin,
  });
  return NextResponse.json({
    snapshot,
    generatedAt: loaded.session.reportGeneratedAt,
    stored: Boolean(loaded.session.reportSnapshot),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const actor = await requireApiUserForSession(id);
  if ("error" in actor) return actor.error;
  const loaded = await loadAccessibleSession(id, actor.user.id, isAdmin(actor.user));
  if ("error" in loaded) return loaded.error;
  if (!loaded.admin && loaded.seat?.kind !== "MODERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await persistSessionReport(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ snapshot, stored: true } satisfies {
    snapshot: SessionReportSnapshot;
    stored: boolean;
  });
}
