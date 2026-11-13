export function normalizeAssignmentHint(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function resolveAssignmentHint<T extends { id: string; name: string }>(
  hint: string | null | undefined,
  options: T[],
) {
  if (!hint?.trim()) return null;
  const normalized = normalizeAssignmentHint(hint);
  return (
    options.find((option) => normalizeAssignmentHint(option.id) === normalized) ??
    options.find((option) => normalizeAssignmentHint(option.name) === normalized) ??
    null
  );
}
