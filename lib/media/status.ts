export type MediaSource = "generated" | "fallback" | "upload" | "library" | "missing";

type LooseMedia = {
  kind?: string;
  assetPath?: string;
  source?: string;
  error?: string;
};

export function mediaSource(item: LooseMedia | null | undefined): MediaSource {
  if (!item) return "missing";
  if (item.source === "generated" || item.source === "fallback" || item.source === "upload") {
    return item.source;
  }
  const path = item.assetPath ?? "";
  if (!path) return "missing";
  if (path.includes("/library/")) return "library";
  if (path.includes("/generated/")) return "generated";
  if (/-stage\.svg(\?|$)/i.test(path)) return "fallback";
  if (path.includes("/uploads/")) return "upload";
  return "upload";
}

export function mediaSourceLabel(source: MediaSource): string {
  switch (source) {
    case "generated":
      return "AI generated";
    case "fallback":
      return "Fallback board";
    case "upload":
      return "Uploaded";
    case "library":
      return "Library asset";
    case "missing":
      return "Not generated";
  }
}

export function mediaReady(item: LooseMedia | null | undefined): boolean {
  return Boolean(item?.assetPath) && mediaSource(item) !== "missing";
}
