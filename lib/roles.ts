export function isAdmin(user: { platformRole: string } | null | undefined) {
  return user?.platformRole === "ADMIN";
}

/** Platform facilitator flag (Admin may also have this). */
export function canFacilitate(
  user: { canFacilitate?: boolean | null } | null | undefined,
) {
  return Boolean(user?.canFacilitate);
}

/** Ops desk: admins and allocated facilitators. Participants stay in the arena. */
export function isDeskOperator(
  user: { platformRole: string; canFacilitate?: boolean | null } | null | undefined,
) {
  return isAdmin(user) || canFacilitate(user);
}

/** Cookie must land on a visible client; otherwise first (or only) visible org. */
export function pickWorkspaceOrgId(
  cookie: string | null | undefined,
  visibleIds: string[],
): string | null {
  if (cookie && visibleIds.includes(cookie)) return cookie;
  if (visibleIds.length === 1) return visibleIds[0]!;
  return null;
}
