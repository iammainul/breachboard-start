import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  exerciseDocumentSchema,
  type ExerciseDocument,
} from "@/lib/schema/exercise";

export const LIBRARY_PACK_FORMAT = "ttx-library-pack" as const;
export const LIBRARY_PACK_VERSION = 1 as const;

const packAssetSchema = z.object({
  path: z.string().min(1),
  contentBase64: z.string().min(1),
});

const packItemSchema = z.object({
  templateKey: z.string().min(1).max(120),
  libraryKind: z.enum(["scenario_pack", "inject_pack"]).default("scenario_pack"),
  libraryTags: z.array(z.string()).default([]),
  title: z.string().min(1),
  durationMin: z.number().int().positive(),
  sector: z.string().min(1),
  coverImagePath: z.string().nullable().optional(),
  document: exerciseDocumentSchema,
  assets: z.array(packAssetSchema).default([]),
});

export const libraryPackSchema = z.object({
  format: z.literal(LIBRARY_PACK_FORMAT),
  version: z.literal(LIBRARY_PACK_VERSION),
  exportedAt: z.string(),
  packs: z.array(packItemSchema).min(1),
});

export type LibraryPack = z.infer<typeof libraryPackSchema>;
export type LibraryPackItem = z.infer<typeof packItemSchema>;

function publicRoot() {
  return path.join(process.cwd(), "public");
}

function safePublicRel(rel: string): string | null {
  const cleaned = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned.startsWith("library/")) return null;
  if (cleaned.includes("..") || path.isAbsolute(cleaned)) return null;
  return cleaned;
}

async function readAssetBase64(coverImagePath: string | null | undefined) {
  if (!coverImagePath) return null;
  const rel = safePublicRel(coverImagePath.replace(/^\//, ""));
  if (!rel) return null;
  const abs = path.join(publicRoot(), rel);
  try {
    const buf = await readFile(abs);
    return { path: rel, contentBase64: buf.toString("base64") };
  } catch {
    return null;
  }
}

function importedAssetDir(templateKey: string) {
  const safe = templateKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return path.join("library", "imported", safe);
}

async function writeImportedAssets(
  templateKey: string,
  assets: { path: string; contentBase64: string }[],
): Promise<string | null> {
  if (assets.length === 0) return null;
  const dirRel = importedAssetDir(templateKey);
  const dirAbs = path.join(publicRoot(), dirRel);
  await mkdir(dirAbs, { recursive: true });

  let coverRel: string | null = null;
  for (const asset of assets) {
    const base = path.basename(asset.path).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!base) continue;
    const destRel = path.join(dirRel, base).replace(/\\/g, "/");
    const destAbs = path.join(publicRoot(), destRel);
    const buf = Buffer.from(asset.contentBase64, "base64");
    if (buf.length > 2_000_000) {
      throw new Error(`Asset too large: ${base}`);
    }
    await writeFile(destAbs, buf);
    if (!coverRel || /cover/i.test(base)) {
      coverRel = `/${destRel}`;
    }
  }
  return coverRel;
}

export async function exportLibraryPack(keys?: string[]): Promise<LibraryPack> {
  const templates = await prisma.exercise.findMany({
    where: {
      isTemplate: true,
      ...(keys?.length ? { templateKey: { in: keys } } : {}),
    },
    orderBy: { title: "asc" },
  });

  if (templates.length === 0) {
    throw new Error("No templates to export");
  }

  const packs: LibraryPackItem[] = [];
  for (const t of templates) {
    const key = t.templateKey;
    if (!key) continue;
    const document = exerciseDocumentSchema.parse(t.document);
    const asset = await readAssetBase64(t.coverImagePath);
    const assets = asset ? [asset] : [];

    // Also collect media assetPaths referenced in injects
    for (const inj of document.injects) {
      for (const media of inj.mediaPrompts ?? []) {
        if (!media.assetPath) continue;
        const assetPath = media.assetPath;
        if (
          assets.some(
            (a) => `/${a.path}` === assetPath || a.path === assetPath.replace(/^\//, ""),
          )
        ) {
          continue;
        }
        const extra = await readAssetBase64(assetPath);
        if (extra) assets.push(extra);
      }
    }

    packs.push({
      templateKey: key,
      libraryKind:
        t.libraryKind === "inject_pack" ? "inject_pack" : "scenario_pack",
      libraryTags: t.libraryTags,
      title: t.title,
      durationMin: t.durationMin,
      sector: t.sector,
      coverImagePath: t.coverImagePath,
      document,
      assets,
    });
  }

  if (packs.length === 0) {
    throw new Error("No exportable templates (missing templateKey)");
  }

  return {
    format: LIBRARY_PACK_FORMAT,
    version: LIBRARY_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    packs,
  };
}

export async function importLibraryPack(raw: unknown): Promise<{
  imported: number;
  keys: string[];
}> {
  const pack = libraryPackSchema.parse(raw);
  const keys: string[] = [];

  for (const item of pack.packs) {
    const document: ExerciseDocument = exerciseDocumentSchema.parse(item.document);
    let coverImagePath = item.coverImagePath ?? null;
    if (item.assets.length > 0) {
      const written = await writeImportedAssets(item.templateKey, item.assets);
      if (written) coverImagePath = written;
    }

    await prisma.exercise.upsert({
      where: { templateKey: item.templateKey },
      create: {
        title: item.title || document.title,
        durationMin: item.durationMin || document.durationMin,
        sector: item.sector || document.sector,
        status: "published",
        document,
        isTemplate: true,
        templateKey: item.templateKey,
        libraryKind: item.libraryKind,
        libraryTags: item.libraryTags,
        coverImagePath,
      },
      update: {
        title: item.title || document.title,
        durationMin: item.durationMin || document.durationMin,
        sector: item.sector || document.sector,
        document,
        isTemplate: true,
        libraryKind: item.libraryKind,
        libraryTags: item.libraryTags,
        coverImagePath,
        status: "published",
      },
    });
    keys.push(item.templateKey);
  }

  return { imported: keys.length, keys };
}

export async function installLibraryPackFromUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }

  const response = await fetch(parsed.toString(), {
    redirect: "follow",
    headers: { Accept: "application/json, application/octet-stream, */*" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("URL did not return JSON pack");
  }
  return importLibraryPack(json);
}

export function packFilename(pack: LibraryPack) {
  const stamp = pack.exportedAt.slice(0, 10);
  if (pack.packs.length === 1) {
    return `${pack.packs[0].templateKey}.ttxpack`;
  }
  const hash = createHash("sha1")
    .update(pack.packs.map((p) => p.templateKey).join(","))
    .digest("hex")
    .slice(0, 8);
  return `library-${stamp}-${hash}.ttxpack`;
}
