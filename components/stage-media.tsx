import { memo } from "react";
import { displayMediaPath } from "@/lib/media/paths";

export const StageMedia = memo(function StageMedia({
  src,
  kind = "image",
  alt = "",
  className = "min-h-40 w-full bg-bg object-contain",
}: {
  src: string;
  kind?: "image" | "video";
  alt?: string;
  className?: string;
}) {
  const href = displayMediaPath(src);
  if (!href) return null;
  if (kind === "video") {
    return (
      <video src={href} controls preload="metadata" className={className} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- runtime Stage assets
    <img
      src={href}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
});
