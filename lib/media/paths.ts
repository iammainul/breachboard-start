const ALLOWED_PREFIXES = ["generated", "uploads", "orgs"] as const;

export function safeMediaRel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^\/+/, "")
    .replace(/^api\/media\//, "")
    .replace(/^media\//, "")
    .replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("/")) return null;
  const prefix = cleaned.split("/")[0];
  if (!ALLOWED_PREFIXES.includes(prefix as (typeof ALLOWED_PREFIXES)[number])) {
    return null;
  }
  return cleaned;
}

export function publicMediaPath(rel: string): string {
  return `/media/${rel.replace(/\\/g, "/")}`;
}

/** Normalize stored asset paths so the browser loads static `/media/...`. */
export function displayMediaPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const rel = safeMediaRel(raw);
  if (rel) return publicMediaPath(rel);
  if (raw.startsWith("/library/")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}
