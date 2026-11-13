import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is required for guest join tokens");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Short-lived token: userId.sessionId.exp.sig — exchanged via guest-join credentials. */
export function mintGuestJoinToken(userId: string, sessionId: string) {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${sessionId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyGuestJoinToken(token: string): {
  userId: string;
  sessionId: string;
  activityExpiresAt: number;
} | null {
  const parts = token.trim().split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionId, expRaw, sig] = parts;
  if (!userId || !sessionId || !expRaw || !sig) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  const payload = `${userId}.${sessionId}.${expRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, sessionId, activityExpiresAt: exp };
}
