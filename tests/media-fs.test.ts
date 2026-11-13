import { describe, expect, test } from "vitest";
import { displayMediaPath, publicMediaPath, safeMediaRel } from "@/lib/media/paths";
import { firstStageAssetPath } from "@/lib/media/first-asset";
import { ensureInjectMediaPrompts } from "@/lib/media/ensure-inject-media";
import { mediaSource, mediaSourceLabel } from "@/lib/media/status";

describe("safeMediaRel", () => {
  test("accepts generated and upload paths", () => {
    expect(safeMediaRel("generated/ex1/inj-0.png")).toBe("generated/ex1/inj-0.png");
    expect(safeMediaRel("/media/uploads/ex1/file.jpg")).toBe("uploads/ex1/file.jpg");
    expect(safeMediaRel("/api/media/generated/ex1/a.png")).toBe("generated/ex1/a.png");
  });

  test("rejects path traversal and unknown prefixes", () => {
    expect(safeMediaRel("../secret.png")).toBeNull();
    expect(safeMediaRel("/etc/passwd")).toBeNull();
    expect(safeMediaRel("tmp/out.png")).toBeNull();
  });
});

describe("publicMediaPath", () => {
  test("serves generated files from the static media prefix", () => {
    expect(publicMediaPath("generated/ex1/a.png")).toBe("/media/generated/ex1/a.png");
  });
});

describe("displayMediaPath", () => {
  test("rewrites legacy api media URLs to static files", () => {
    expect(displayMediaPath("/api/media/generated/ex/a.png")).toBe(
      "/media/generated/ex/a.png",
    );
  });

  test("leaves library pack assets unchanged", () => {
    expect(displayMediaPath("/library/bec-ceo-fraud/inject-01.svg")).toBe(
      "/library/bec-ceo-fraud/inject-01.svg",
    );
  });
});

describe("firstStageAssetPath", () => {
  test("returns the first inject image asset", () => {
    const path = firstStageAssetPath({
      injects: [
        { mediaPrompts: [{ kind: "video", prompt: "cue" }] },
        {
          mediaPrompts: [
            { kind: "image", prompt: "SOC wall", assetPath: "/api/media/generated/ex/i1-0.png" },
          ],
        },
      ],
    });
    expect(path).toBe("/media/generated/ex/i1-0.png");
  });

  test("returns null when no image asset exists", () => {
    expect(firstStageAssetPath({ injects: [] })).toBeNull();
    expect(firstStageAssetPath(null)).toBeNull();
  });
});

describe("ensureInjectMediaPrompts", () => {
  test("adds an image prompt to every inject that is missing one", () => {
    const next = ensureInjectMediaPrompts({
      injects: [
        {
          id: "inj-01",
          sequence: 1,
          title: "Phish",
          body: "Mailbox alert",
          mediaPrompts: [{ kind: "image", prompt: "Already has a long enough prompt." }],
        },
        {
          id: "inj-02",
          sequence: 2,
          title: "Lateral",
          body: "Admin share",
          mediaPrompts: [],
        },
      ],
    } as never);

    expect(next.injects[0].mediaPrompts).toHaveLength(1);
    expect(next.injects[1].mediaPrompts?.[0]?.kind).toBe("image");
    expect(next.injects[1].mediaPrompts?.[0]?.prompt).toContain("Lateral");
  });
});

describe("mediaSource", () => {
  test("classifies generated, fallback, upload, and missing boards", () => {
    expect(mediaSource({ source: "generated", assetPath: "/media/generated/a.png" })).toBe(
      "generated",
    );
    expect(mediaSource({ assetPath: "/media/generated/ex/i-0.png" })).toBe("generated");
    expect(mediaSource({ assetPath: "/media/uploads/ex/inj-stage.svg" })).toBe("fallback");
    expect(mediaSource({ assetPath: "/media/uploads/ex/photo.png" })).toBe("upload");
    expect(mediaSource({ assetPath: "/library/bec-ceo-fraud/inject-01.svg" })).toBe(
      "library",
    );
    expect(mediaSource({})).toBe("missing");
    expect(mediaSourceLabel("missing")).toBe("Not generated");
    expect(mediaSourceLabel("generated")).toBe("AI generated");
  });
});
