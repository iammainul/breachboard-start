import { describe, expect, it } from "vitest";
import {
  hasPathTraversal,
  sanitizeUploadFilename,
  validateUpload,
} from "@/lib/security/upload";

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const pdf = Uint8Array.from([...Buffer.from("%PDF-1.7\n%"), 0, 1, 2, 3]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);

describe("sanitizeUploadFilename", () => {
  it("strips path segments and traversal", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("C:\\\\temp\\\\plan.pdf")).toBe("plan.pdf");
    expect(hasPathTraversal("../secret")).toBe(true);
    expect(hasPathTraversal("plan.pdf")).toBe(false);
  });
});

describe("validateUpload", () => {
  it("accepts PNG whose magic matches the name", () => {
    const ok = validateUpload({
      kind: "inject-media",
      filename: "board.png",
      declaredMime: "image/png",
      bytes: png,
    });
    expect("ext" in ok && ok.ext).toBe("png");
  });

  it("rejects a PDF labeled as a PNG", () => {
    const bad = validateUpload({
      kind: "inject-media",
      filename: "board.png",
      declaredMime: "image/png",
      bytes: pdf,
    });
    expect("error" in bad).toBe(true);
  });

  it("rejects SVG and oversize org docs", () => {
    const svg = validateUpload({
      kind: "inject-media",
      filename: "xss.svg",
      declaredMime: "image/svg+xml",
      bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    });
    expect("error" in svg).toBe(true);

    const huge = validateUpload({
      kind: "org-doc",
      filename: "irp.pdf",
      declaredMime: "application/pdf",
      bytes: pdf,
      size: 40 * 1024 * 1024,
    });
    expect("error" in huge).toBe(true);
  });

  it("accepts UTF-8 IRP text and JPEG media", () => {
    const text = validateUpload({
      kind: "org-doc",
      filename: "irp.md",
      declaredMime: "text/markdown",
      bytes: Buffer.from("# Incident response\nIsolate first."),
    });
    expect("ext" in text && text.ext).toBe("md");

    const image = validateUpload({
      kind: "inject-media",
      filename: "stage.jpg",
      declaredMime: "image/jpeg",
      bytes: jpeg,
    });
    expect("ext" in image && image.ext).toBe("jpg");
  });
});
