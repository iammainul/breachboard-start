type ReportAnswer = {
  userId?: string;
  body: string;
  aiNotes: string | null;
  overrideComment: string | null;
};

export function redactSessionReport<T extends { answers: ReportAnswer[] }>(
  snapshot: T,
  viewer: { userId: string; seatKind?: string | null; isAdmin: boolean },
): T {
  const reveal =
    viewer.seatKind === "MODERATOR" || (viewer.isAdmin && !viewer.seatKind);
  if (reveal) return snapshot;
  const answers = snapshot.answers
    .filter((row) => {
      if (viewer.seatKind === "OBSERVER") return true;
      if (row.userId) return row.userId === viewer.userId;
      return true;
    })
    .map((row) => ({
      ...row,
      aiNotes: null,
      overrideComment: null,
      body:
        viewer.seatKind === "OBSERVER" || row.userId === viewer.userId
          ? row.body
          : "",
    }));
  return { ...snapshot, answers };
}
