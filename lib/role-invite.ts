export function roleInviteLink(origin: string, token: string) {
  return `${origin}/invite/${encodeURIComponent(token)}`;
}
