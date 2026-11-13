type LooseMedia = { kind?: string; assetPath?: string; source?: string };

export function keepMediaIndex<T extends LooseMedia>(items: T[], keepIndex: number): T[] {
  if (keepIndex < 0 || keepIndex >= items.length) return items;
  const keep = items[keepIndex];
  if (keep.kind === "video") {
    return items.filter((item, i) => i === keepIndex || item.kind !== "video");
  }
  return items.filter((item, i) => i === keepIndex || item.kind === "video");
}

export function removeMediaIndex<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, i) => i !== index);
}

/** Live Stage / console: one image (prefer AI) plus any videos. */
export function stageMediaItems<T extends LooseMedia>(
  items: T[] | null | undefined,
): T[] {
  const list = items ?? [];
  const images = list.filter((item) => item.kind !== "video");
  const videos = list.filter((item) => item.kind === "video");
  const chosen =
    images.find((item) => item.source === "generated" && item.assetPath) ??
    images.find((item) => item.assetPath) ??
    images[0];
  return chosen ? [chosen, ...videos] : videos;
}

export function discardedMedia<T extends LooseMedia>(
  before: T[],
  after: T[],
): T[] {
  const kept = new Set(after.map((item) => item.assetPath).filter(Boolean));
  return before.filter(
    (item) => item.assetPath && !kept.has(item.assetPath),
  );
}
