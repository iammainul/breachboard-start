/** How long since last poll before a seated player counts as left/away. */
export const PRESENCE_ONLINE_MS = 25_000;

export type SeatPresence = "online" | "waiting" | "left";

export function seatPresence(
  lastSeenAt: Date | string | null | undefined,
  now = Date.now(),
): SeatPresence {
  if (!lastSeenAt) return "waiting";
  const ts =
    typeof lastSeenAt === "string"
      ? Date.parse(lastSeenAt)
      : lastSeenAt.getTime();
  if (!Number.isFinite(ts)) return "waiting";
  return now - ts <= PRESENCE_ONLINE_MS ? "online" : "left";
}

export function presenceLabel(status: SeatPresence): string {
  switch (status) {
    case "online":
      return "Online";
    case "waiting":
      return "Yet to join";
    case "left":
      return "Left";
  }
}
