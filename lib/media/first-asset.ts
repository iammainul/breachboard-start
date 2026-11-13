import { displayMediaPath } from "@/lib/media/paths";

type LooseMedia = { kind?: string; assetPath?: string };
type LooseInject = { mediaPrompts?: LooseMedia[] };

function injectsFrom(document: unknown): LooseInject[] {
  if (!document || typeof document !== "object") return [];
  const injects = (document as { injects?: unknown }).injects;
  return Array.isArray(injects) ? (injects as LooseInject[]) : [];
}

export function firstStageAssetPath(document: unknown): string | null {
  for (const inject of injectsFrom(document)) {
    const hit = (inject.mediaPrompts ?? []).find(
      (m) => m.kind === "image" && typeof m.assetPath === "string" && m.assetPath,
    );
    if (hit?.assetPath) return displayMediaPath(hit.assetPath);
  }
  return null;
}
