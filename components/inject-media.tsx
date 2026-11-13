import { memo } from "react";
import { StageMedia } from "@/components/stage-media";
import {
  mediaReady,
  mediaSource,
  mediaSourceLabel,
  type MediaSource,
} from "@/lib/media/status";
import { stageMediaItems } from "@/lib/media/pick";

type MediaItem = {
  kind?: string;
  assetPath?: string;
  source?: string;
  error?: string;
  prompt?: string;
};

function sourceChipClass(source: MediaSource) {
  if (source === "generated") return "chip chip-on";
  if (source === "missing") return "chip text-warn";
  if (source === "fallback") return "chip";
  return "chip";
}

function mediaListKey(items?: MediaItem[] | null) {
  return (items ?? [])
    .map((item) => `${item.kind}:${item.assetPath ?? ""}:${item.source ?? ""}`)
    .join("|");
}

export const InjectMediaList = memo(function InjectMediaList({
  items,
  size = "session",
  showStatus = true,
  pick = "stage",
}: {
  items?: MediaItem[] | null;
  size?: "session" | "stage" | "thumb" | "present";
  showStatus?: boolean;
  /** `stage` shows one image (prefer AI) plus videos. `all` is for the editor picker. */
  pick?: "stage" | "all";
}) {
  const compact = size === "thumb" || size === "stage" || size === "present";
  const list = pick === "all" ? (items ?? []) : stageMediaItems(items);
  if (list.length === 0) return null;
  const mediaClass =
    size === "stage"
      ? "max-h-full w-full bg-bg object-contain"
      : size === "present"
        ? "max-h-full w-full bg-bg object-contain"
        : size === "thumb"
          ? "h-full w-full object-contain"
          : "min-h-40 max-h-80 w-full bg-bg object-contain";

  return (
    <div
      className={
        size === "thumb"
          ? "h-full w-full"
          : size === "present" || size === "stage"
            ? "flex h-full min-h-0 flex-col gap-2"
            : "flex flex-col gap-3"
      }
    >
      {list.map((item, idx) => {
        const source = mediaSource(item);
        const ready = mediaReady(item);
        return (
          <div
            key={`${item.assetPath ?? "missing"}-${idx}`}
            className={
              size === "thumb"
                ? "relative h-full w-full overflow-hidden bg-bg"
                : size === "present" || size === "stage"
                  ? "glass-tile relative min-h-0 flex-1 overflow-hidden"
                  : "glass-tile relative overflow-hidden"
            }
          >
            {ready ? (
              <StageMedia
                src={item.assetPath!}
                kind={item.kind === "video" ? "video" : "image"}
                className={mediaClass}
              />
            ) : (
              <div
                className={
                  size === "thumb"
                    ? "flex h-full items-center justify-center px-2 text-center text-[11px] text-muted"
                    : "flex min-h-40 items-center justify-center px-4 py-8 text-center text-[13px] text-muted"
                }
              >
                {item.kind === "video"
                  ? "Video cue — no file attached"
                  : "Image not generated yet"}
              </div>
            )}
            {showStatus && !compact ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border-soft px-3 py-2">
                <span className={sourceChipClass(source)}>
                  {mediaSourceLabel(source)}
                </span>
                {item.error ? (
                  <span className="text-[11px] text-warn">{item.error}</span>
                ) : null}
              </div>
            ) : null}
            {showStatus && compact && source !== "generated" && source !== "library" ? (
              <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meta">
                {mediaSourceLabel(source)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}, (prev, next) =>
  prev.size === next.size &&
  prev.showStatus === next.showStatus &&
  prev.pick === next.pick &&
  mediaListKey(prev.items) === mediaListKey(next.items),
);
