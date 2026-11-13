import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFacilitate, isAdmin, isDeskOperator } from "@/lib/roles";
import { logSecurityEvent } from "@/lib/logger";
import { guestActivityDenied } from "@/lib/security/session-policy";

export { canFacilitate, isAdmin, isDeskOperator };

export type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

export async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      canFacilitate: true,
      organizationId: true,
      authEpoch: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!user) return null;
  // Concurrent-session lock: JWT epoch must match DB (bumped on each onboard/login).
  if (
    typeof session.user.authEpoch === "number" &&
    session.user.authEpoch !== user.authEpoch
  ) {
    return null;
  }
  if (typeof session.user.authEpoch !== "number") {
    // Pre-epoch cookies — require a fresh sign-in.
    return null;
  }
  const { authEpoch: _epoch, ...safe } = user;
  return {
    ...safe,
    activitySessionId:
      typeof session.user.activitySessionId === "string"
        ? session.user.activitySessionId
        : undefined,
  };
}

export function sessionActorDenied(
  user: { activitySessionId?: string | null },
  sessionId: string,
) {
  const denied = guestActivityDenied(user.activitySessionId, sessionId);
  if (!denied) return null;
  logSecurityEvent("authz_denied", {
    code: denied.code,
    route: "session",
    status: denied.status,
  });
  return NextResponse.json(
    { error: denied.error, code: denied.code },
    { status: denied.status },
  );
}

/** Page/RSC counterpart: hide other runs from guest-locked JWTs. */
export function assertPageSessionAccess(
  user: { activitySessionId?: string | null },
  sessionId: string,
) {
  if (guestActivityDenied(user.activitySessionId, sessionId)) notFound();
}

/**
 * Live session control (go live, release injects, seat people, teams).
 * Requires a MODERATOR seat — Admin-only without facilitator seat cannot control.
 */
export function canManageLiveSession(
  user: { platformRole: string; canFacilitate?: boolean | null } | null | undefined,
  seat: { kind: string } | null | undefined,
) {
  return seat?.kind === "MODERATOR";
}

/** Prep seating of facilitators: target must be canFacilitate. */
export function canBeSeatedAsFacilitator(
  user: { canFacilitate?: boolean | null } | null | undefined,
) {
  return Boolean(user?.canFacilitate);
}

export async function requirePageUser() {
  const user = await getActor();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser();
  if (!isAdmin(user)) redirect("/");
  return user;
}

export async function requirePageOperator() {
  const user = await requirePageUser();
  if (!isDeskOperator(user)) redirect("/");
  return user;
}

export async function requireApiUser() {
  const user = await getActor();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

/** Session-scoped APIs: auth plus guest activity lock (defense in depth vs proxy). */
export async function requireApiUserForSession(sessionId: string) {
  const result = await requireApiUser();
  if ("error" in result) return result;
  const locked = sessionActorDenied(result.user, sessionId);
  if (locked) return { error: locked };
  return result;
}

export async function requireApiAdmin() {
  const result = await requireApiUser();
  if ("error" in result) return result;
  if (!isAdmin(result.user)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}

export async function requireApiOperator() {
  const result = await requireApiUser();
  if ("error" in result) return result;
  if (!isDeskOperator(result.user)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
