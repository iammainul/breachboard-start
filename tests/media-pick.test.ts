import { describe, expect, test } from "vitest";
import {
  discardedMedia,
  keepMediaIndex,
  removeMediaIndex,
  stageMediaItems,
} from "@/lib/media/pick";

const a = {
  kind: "image",
  assetPath: "/media/generated/ex/a.png",
  source: "generated",
};
const b = {
  kind: "image",
  assetPath: "/media/generated/ex/b.png",
  source: "fallback",
};
const vid = {
  kind: "video",
  assetPath: "/media/uploads/ex/cue.mp4",
  source: "upload",
};

describe("keepMediaIndex", () => {
  test("keeps the chosen image and any videos", () => {
    expect(keepMediaIndex([a, b, vid], 1)).toEqual([b, vid]);
  });

  test("keeps the chosen video and all images", () => {
    expect(keepMediaIndex([a, vid, b], 1)).toEqual([a, vid, b].filter((_, i) => i === 1 || _.kind !== "video"));
    expect(keepMediaIndex([a, vid, b], 1)).toEqual([a, vid, b]);
  });

  test("returns the list unchanged for an out-of-range index", () => {
    expect(keepMediaIndex([a, b], 9)).toEqual([a, b]);
    expect(keepMediaIndex([a, b], -1)).toEqual([a, b]);
  });
});

describe("removeMediaIndex", () => {
  test("drops only that item", () => {
    expect(removeMediaIndex([a, b, vid], 0)).toEqual([b, vid]);
  });

  test("returns the list unchanged for an out-of-range index", () => {
    expect(removeMediaIndex([a], 3)).toEqual([a]);
  });
});

describe("stageMediaItems", () => {
  test("shows one image preferring generated, plus videos", () => {
    expect(stageMediaItems([b, a, vid])).toEqual([a, vid]);
  });

  test("falls back to the first image with a file", () => {
    expect(stageMediaItems([b, { kind: "image", prompt: "none" }])).toEqual([b]);
  });

  test("returns only videos when there is no image", () => {
    expect(stageMediaItems([vid])).toEqual([vid]);
    expect(stageMediaItems([])).toEqual([]);
    expect(stageMediaItems(null)).toEqual([]);
  });
});

describe("discardedMedia", () => {
  test("lists files that left the set", () => {
    expect(discardedMedia([a, b, vid], [b, vid])).toEqual([a]);
  });
});
