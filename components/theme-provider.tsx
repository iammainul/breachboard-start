"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FINISH,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  LEGACY_TTX_THEME_STORAGE_KEY,
  resolveThemeId,
  type ThemeId,
} from "@/lib/themes";

function applyChrome(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-finish", DEFAULT_FINISH);
}

function readStoredTheme(): ThemeId {
  return resolveThemeId(
    localStorage.getItem(THEME_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_THEME_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_TTX_THEME_STORAGE_KEY),
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyChrome(readStoredTheme());
  }, []);

  return children;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const nextTheme = readStoredTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted preference
    setThemeState(nextTheme);
    applyChrome(nextTheme);
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    applyChrome(id);
  }

  return { theme, setTheme, finish: DEFAULT_FINISH };
}
