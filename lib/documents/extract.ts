import path from "node:path";
import {
  EXTRACT_MAX_BYTES,
  EXTRACT_MAX_CHARS,
  EXTRACT_MAX_PAGES,
  GRADE_EXCERPT_CHARS,
  type ExtractStatus,
} from "@/lib/documents/constants";

export type ExtractResult = {
  text: string | null;
  status: ExtractStatus;
  error: string | null;
  pageCount: number | null;
  truncated: boolean;
};

export type ExtractInput = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  maxPages?: number;
  maxChars?: number;
};

type PdfParser = (bytes: Uint8Array, maxPages: number) => Promise<{
  text: string;
  pageCount: number;
  truncated: boolean;
}>;

type DocxParser = (bytes: Uint8Array) => Promise<string>;

export type ExtractParsers = {
  pdf?: PdfParser;
  docx?: DocxParser;
};

function looksLikeText(mime: string, filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if ([".txt", ".md", ".csv"].includes(ext)) return true;
  return (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "text/csv" ||
    mime.startsWith("text/")
  );
}

function isPdf(mime: string, filename: string) {
  return (
    mime === "application/pdf" || path.extname(filename).toLowerCase() === ".pdf"
  );
}

function isDocx(mime: string, filename: string) {
  return (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    path.extname(filename).toLowerCase() === ".docx"
  );
}

function isLegacyDoc(mime: string, filename: string) {
  return (
    mime === "application/msword" || path.extname(filename).toLowerCase() === ".doc"
  );
}

function clip(text: string, maxChars: number): { text: string; truncated: boolean } {
  const trimmed = text.replace(/\u0000/g, "").trim();
  if (trimmed.length <= maxChars) return { text: trimmed, truncated: false };
  return { text: trimmed.slice(0, maxChars), truncated: true };
}

async function defaultPdfParser(
  bytes: Uint8Array,
  maxPages: number,
): Promise<{ text: string; pageCount: number; truncated: boolean }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
  });
  const pdf = await task.promise;
  const pageCount = pdf.numPages;
  const limit = Math.min(pageCount, maxPages);
  const parts: string[] = [];
  for (let i = 1; i <= limit; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    parts.push(line);
  }
  await pdf.destroy();
  return {
    text: parts.join("\n"),
    pageCount,
    truncated: pageCount > maxPages,
  };
}

async function defaultDocxParser(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value ?? "";
}

/**
 * Extract plaintext for grading. Failures never throw to the caller —
 * they return status=failed|skipped so upload still succeeds.
 */
export async function extractDocumentText(
  input: ExtractInput,
  parsers: ExtractParsers = {},
): Promise<ExtractResult> {
  const maxPages = input.maxPages ?? EXTRACT_MAX_PAGES;
  const maxChars = input.maxChars ?? EXTRACT_MAX_CHARS;
  const mime = (input.mimeType || "").toLowerCase();
  const name = input.filename || "document";

  if (!input.bytes?.length) {
    return {
      text: null,
      status: "failed",
      error: "Empty file",
      pageCount: null,
      truncated: false,
    };
  }
  if (input.bytes.byteLength > EXTRACT_MAX_BYTES) {
    return {
      text: null,
      status: "skipped",
      error: `File exceeds ${EXTRACT_MAX_BYTES} byte extract cap`,
      pageCount: null,
      truncated: false,
    };
  }

  try {
    if (looksLikeText(mime, name)) {
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
      const clipped = clip(raw, maxChars);
      return {
        text: clipped.text || null,
        status: clipped.text ? "ok" : "failed",
        error: clipped.text ? null : "No extractable text",
        pageCount: null,
        truncated: clipped.truncated,
      };
    }

    if (isPdf(mime, name)) {
      const parse = parsers.pdf ?? defaultPdfParser;
      const parsed = await parse(input.bytes, maxPages);
      const clipped = clip(parsed.text, maxChars);
      return {
        text: clipped.text || null,
        status: clipped.text ? "ok" : "failed",
        error: clipped.text ? null : "PDF contained no extractable text",
        pageCount: parsed.pageCount,
        truncated: parsed.truncated || clipped.truncated,
      };
    }

    if (isDocx(mime, name)) {
      const parse = parsers.docx ?? defaultDocxParser;
      const raw = await parse(input.bytes);
      const clipped = clip(raw, maxChars);
      return {
        text: clipped.text || null,
        status: clipped.text ? "ok" : "failed",
        error: clipped.text ? null : "DOCX contained no extractable text",
        pageCount: null,
        truncated: clipped.truncated,
      };
    }

    if (isLegacyDoc(mime, name)) {
      return {
        text: null,
        status: "skipped",
        error: "Legacy .doc is not extracted; upload DOCX or PDF",
        pageCount: null,
        truncated: false,
      };
    }

    return {
      text: null,
      status: "skipped",
      error: "No extractor for this file type",
      pageCount: null,
      truncated: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "Extraction failed";
    return {
      text: null,
      status: "failed",
      error: message,
      pageCount: null,
      truncated: false,
    };
  }
}

export function gradeExcerpt(text: string | null | undefined, max = GRADE_EXCERPT_CHARS) {
  if (!text?.trim()) return null;
  return text.trim().slice(0, max);
}
