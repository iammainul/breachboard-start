import "server-only";

import { prisma } from "@/lib/prisma";

/** Invalidate every other JWT for this user (single active browser/device). */
export async function bumpAuthEpoch(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { authEpoch: { increment: 1 } },
    select: { authEpoch: true },
  });
  return updated.authEpoch;
}

export async function readAuthEpoch(userId: string): Promise<number | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { authEpoch: true },
  });
  return row?.authEpoch ?? null;
}

export function epochsMatch(
  tokenEpoch: unknown,
  dbEpoch: number | null | undefined,
): boolean {
  if (dbEpoch == null) return false;
  if (typeof tokenEpoch !== "number" || !Number.isFinite(tokenEpoch)) {
    // Legacy JWTs without epoch — force re-auth once schema is live.
    return false;
  }
  return tokenEpoch === dbEpoch;
}
