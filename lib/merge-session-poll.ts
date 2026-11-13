/**
 * Merge a poll=1 session payload into the previous full payload.
 * Polls omit `injects` and `people` to shrink JSON; keep cached copies.
 */
export function mergeSessionPollPayload<T extends Record<string, unknown>>(
  prev: T | null,
  next: unknown,
  meta: { poll: boolean },
): T {
  const incoming = next as T & {
    injects?: unknown;
    people?: unknown;
    exerciseRevision?: string;
  };

  if (!meta.poll || !prev) {
    return {
      ...incoming,
      injects: incoming.injects ?? (prev as { injects?: unknown } | null)?.injects ?? [],
      people: incoming.people ?? (prev as { people?: unknown } | null)?.people ?? [],
    } as T;
  }

  const prevTyped = prev as T & {
    injects?: unknown;
    people?: unknown;
    exerciseRevision?: string;
  };

  return {
    ...prevTyped,
    ...incoming,
    injects: Array.isArray(incoming.injects)
      ? incoming.injects
      : (prevTyped.injects ?? []),
    people:
      Array.isArray(incoming.people) && incoming.people.length > 0
        ? incoming.people
        : (prevTyped.people ?? []),
  } as T;
}

export function sessionNeedsFullReload(
  prev: { exerciseRevision?: string } | null,
  next: { exerciseRevision?: string },
  poll: boolean,
): boolean {
  if (!poll || !prev?.exerciseRevision || !next.exerciseRevision) return false;
  return next.exerciseRevision !== prev.exerciseRevision;
}
