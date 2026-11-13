import path from "node:path";

export type UploadKind =
  | "org-doc"
  | "inject-media"
  | "user-import"
  | "library-pack";

export type UploadDenial = { error: string; status: 400 };

const MAGIC = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
  zip: [0x50, 0x4b, 0x03, 0x04], // PK.. (docx / xlsx / webp container)
  ole: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // .doc
  ebml: [0x1a, 0x45, 0xdf, 0xa3], // webm
  riff: [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP
} as const;

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  "org-doc": 25 * 1024 * 1024,
  "inject-media": 40 * 1024 * 1024,
  "user-import": 5 * 1024 * 1024,
  "library-pack": 5 * 1024 * 1024,
};

const ORG_DOC_EXTS = new Set(["pdf", "doc", "docx", "txt", "md", "csv"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const VIDEO_EXTS = new Set(["mp4", "webm"]);
const IMPORT_EXTS = new Set(["csv", "xlsx", "xls"]);
const PACK_EXTS = new Set(["json"]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/json": "json",
};

function startsWith(bytes: Uint8Array, magic: readonly number[], offset = 0) {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((value, i) => bytes[offset + i] === value);
}

function isUtf8Text(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
    return true;
  } catch {
    return false;
  }
}

function detectedExt(bytes: Uint8Array): string | null {
  if (startsWith(bytes, MAGIC.pdf)) return "pdf";
  if (startsWith(bytes, MAGIC.png)) return "png";
  if (startsWith(bytes, MAGIC.jpeg)) return "jpg";
  if (startsWith(bytes, MAGIC.gif)) return "gif";
  if (startsWith(bytes, MAGIC.ole)) return "ole";
  if (startsWith(bytes, MAGIC.ebml)) return "webm";
  if (startsWith(bytes, MAGIC.riff) && bytes.length >= 12) {
    const tag = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (tag === "WEBP") return "webp";
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "mp4";
  }
  if (startsWith(bytes, MAGIC.zip)) {
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 256))).toString("utf8");
    if (head.includes("word/")) return "docx";
    if (head.includes("xl/") || head.includes("workbook")) return "xlsx";
    // zip without office marks: reject rather than guess
    return "zip";
  }
  if (isUtf8Text(bytes)) {
    const sample = Buffer.from(bytes.subarray(0, 256)).toString("utf8").trimStart();
    if (sample.startsWith("{") || sample.startsWith("[")) return "json";
    return "txt";
  }
  return null;
}

export function extensionOf(name: string): string {
  return path.extname(name).replace(".", "").toLowerCase();
}

/** Basename only, no separators, no reserved names. */
export function sanitizeUploadFilename(name: string, fallback = "upload"): string {
  const base = path.basename((name || fallback).replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180)
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  if (cleaned.includes("..") || cleaned.includes("/") || cleaned.includes("\\")) {
    return fallback;
  }
  return cleaned;
}

export function hasPathTraversal(name: string) {
  const normalized = name.replace(/\\/g, "/");
  return (
    normalized.includes("..") ||
    path.isAbsolute(name) ||
    normalized.startsWith("/") ||
    normalized.includes("\0")
  );
}

export type ValidatedUpload = {
  ext: string;
  mime: string;
  displayName: string;
  kind: "image" | "video" | "document" | "spreadsheet" | "json" | "text";
};

const KIND_BY_EXT: Record<string, ValidatedUpload["kind"]> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  mp4: "video",
  webm: "video",
  pdf: "document",
  doc: "document",
  docx: "document",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  json: "json",
  txt: "text",
  md: "text",
  csv: "text",
};

function allowedExts(kind: UploadKind): Set<string> {
  if (kind === "org-doc") return ORG_DOC_EXTS;
  if (kind === "inject-media") return new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);
  if (kind === "user-import") return IMPORT_EXTS;
  return PACK_EXTS;
}

export function validateUpload(input: {
  kind: UploadKind;
  filename: string;
  declaredMime?: string | null;
  bytes: Uint8Array;
  size?: number;
}): ValidatedUpload | UploadDenial {
  const filename = input.filename || "upload";
  if (hasPathTraversal(filename)) {
    return { error: "Invalid filename", status: 400 };
  }
  const displayName = sanitizeUploadFilename(filename);
  const size = input.size ?? input.bytes.length;
  const max = UPLOAD_LIMITS[input.kind];
  if (size <= 0 || size > max) {
    return {
      error: `File must be between 1 byte and ${Math.round(max / (1024 * 1024))} MB`,
      status: 400,
    };
  }

  const declaredMime = (input.declaredMime || "").toLowerCase().split(";")[0]!.trim();
  const nameExt = extensionOf(displayName);
  const mimeExt = MIME_TO_EXT[declaredMime];
  const magicExt = detectedExt(input.bytes);

  const allowed = allowedExts(input.kind);
  const candidate = (mimeExt && allowed.has(mimeExt) ? mimeExt : null) ??
    (nameExt && allowed.has(nameExt) ? nameExt : null);

  if (!candidate) {
    return { error: "Unsupported file type", status: 400 };
  }

  if (input.kind === "org-doc" && (candidate === "txt" || candidate === "md" || candidate === "csv")) {
    if (!isUtf8Text(input.bytes)) {
      return { error: "Text files must be valid UTF-8 without null bytes", status: 400 };
    }
  } else if (input.kind === "library-pack") {
    if (magicExt !== "json" && !isUtf8Text(input.bytes)) {
      return { error: "Library packs must be JSON", status: 400 };
    }
  } else if (input.kind === "user-import" && candidate === "csv") {
    if (!isUtf8Text(input.bytes)) {
      return { error: "CSV must be valid UTF-8 without null bytes", status: 400 };
    }
  } else if (magicExt) {
    const compatible =
      magicExt === candidate ||
      (magicExt === "jpg" && candidate === "jpeg") ||
      (magicExt === "txt" && (candidate === "md" || candidate === "csv" || candidate === "txt")) ||
      (magicExt === "md" && (candidate === "md" || candidate === "txt")) ||
      (magicExt === "zip" && (candidate === "docx" || candidate === "xlsx")) ||
      (magicExt === "ole" && (candidate === "doc" || candidate === "xls"));
    if (!compatible) {
      return { error: "File contents do not match the declared type", status: 400 };
    }
  } else if (candidate !== "csv" && candidate !== "txt" && candidate !== "md" && candidate !== "json") {
    return { error: "File contents do not match the declared type", status: 400 };
  }

  const ext = candidate === "jpeg" ? "jpg" : candidate;
  return {
    ext,
    mime: declaredMime || `application/octet-stream`,
    displayName,
    kind: KIND_BY_EXT[ext] ?? "document",
  };
}
