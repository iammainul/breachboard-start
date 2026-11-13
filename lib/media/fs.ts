import "server-only";

import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { publicMediaPath, safeMediaRel } from "@/lib/media/paths";

export { displayMediaPath, publicMediaPath, safeMediaRel } from "@/lib/media/paths";

/**
 * Default media directory is a static cwd + data/media join so Turbopack can
 * scope file tracing. That path is outside public/, so Next cannot statically
 * serve IRP/CCMP. MEDIA_ROOT (Docker volume) is opted out of tracing with
 * turbopackIgnore — those files are not part of the standalone image.
 */
export function mediaRoot(): string {
  const override = process.env.MEDIA_ROOT?.trim();
  if (override) {
    return path.resolve(/*turbopackIgnore: true*/ override);
  }
  return path.join(process.cwd(), "data", "media");
}

function absMediaPath(rel: string): string {
  const override = process.env.MEDIA_ROOT?.trim();
  if (override) {
    return path.join(/*turbopackIgnore: true*/ path.resolve(override), rel);
  }
  return path.join(process.cwd(), "data", "media", rel);
}

export async function writeMediaFile(
  relDir: string,
  fileName: string,
  bytes: Uint8Array | Buffer,
): Promise<string> {
  const safeDir = safeMediaRel(relDir);
  if (!safeDir) throw new Error("Invalid media directory");
  const absDir = absMediaPath(safeDir);
  await mkdir(/*turbopackIgnore: true*/ absDir, { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ path.join(absDir, fileName),
    bytes,
  );
  return publicMediaPath(`${safeDir}/${fileName}`);
}

export async function resolveMediaFile(rawPath: string): Promise<{
  abs: string;
  contentType: string;
} | null> {
  const rel = safeMediaRel(rawPath);
  if (!rel) return null;
  const abs = absMediaPath(rel);
  try {
    const info = await stat(/*turbopackIgnore: true*/ abs);
    if (!info.isFile()) return null;
  } catch {
    return null;
  }
  return { abs, contentType: contentTypeFor(rel) };
}

export async function deleteMediaFile(rawPath: string | undefined): Promise<void> {
  if (!rawPath) return;
  const rel = safeMediaRel(rawPath);
  if (!rel) return;
  await unlink(/*turbopackIgnore: true*/ absMediaPath(rel)).catch(() => undefined);
}

function contentTypeFor(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".doc":
      return "application/msword";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".csv":
      return "text/csv; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
