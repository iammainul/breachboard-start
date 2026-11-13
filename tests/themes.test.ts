import { describe, expect, test } from "vitest";
import {
  DEFAULT_FINISH,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  resolveFinishId,
  resolveThemeId,
} from "@/lib/themes";

describe("resolveThemeId", () => {
  test("returns dark for the default ops desk", () => {
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME);
    expect(resolveThemeId(null)).toBe("dark");
  });

  test("accepts locked brand theme ids", () => {
    expect(resolveThemeId("dark")).toBe("dark");
    expect(resolveThemeId("light")).toBe("light");
  });

  test("maps legacy institutional themes onto the brand field", () => {
    expect(resolveThemeId("institution")).toBe("light");
    expect(resolveThemeId("regulator")).toBe("light");
    expect(resolveThemeId("arena")).toBe("dark");
    expect(resolveThemeId("nightops")).toBe("dark");
  });

  test("falls back to dark for unknown values", () => {
    expect(resolveThemeId("purple-ai")).toBe("dark");
  });
});

describe("resolveFinishId", () => {
  test("always resolves to liquid glass", () => {
    expect(DEFAULT_FINISH).toBe("glass");
    expect(resolveFinishId(undefined)).toBe("glass");
    expect(resolveFinishId("brutal")).toBe("glass");
    expect(resolveFinishId("glass")).toBe("glass");
  });
});

describe("storage keys", () => {
  test("uses the parent-brand theme key", () => {
    expect(THEME_STORAGE_KEY).toBe("breachboard-theme");
  });
});
