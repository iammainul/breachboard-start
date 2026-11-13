/** Draft rehearsal rooms can be removed. Engagements are archived, not deleted. */
export function draftRunDeleteError(session: {
  runKind: string;
} | null): { error: string; status: number } | null {
  if (!session) return { error: "Not found", status: 404 };
  if (session.runKind !== "draft") {
    return {
      error: "Engagements cannot be deleted. Archive them from Closed instead.",
      status: 409,
    };
  }
  return null;
}
