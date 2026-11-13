"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Switch to Toxic Phosphor Day" : "Switch to Pitch Obsidian";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={
        compact
          ? "btn btn-ghost h-9 w-9 shrink-0 px-0"
          : "btn btn-ghost h-9 gap-2 px-3 text-[12px]"
      }
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {compact ? null : (
        <span className="hidden sm:inline">{theme === "dark" ? "Day" : "Night"}</span>
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M8 11.5A3.5 3.5 0 118 4.5a3.5 3.5 0 010 7zM7.25 1h1.5v2h-1.5V1zm0 12h1.5v2h-1.5v-2zM1 7.25h2v1.5H1v-1.5zm12 0h2v1.5h-2v-1.5zM2.64 2.64l1.41 1.41-1.06 1.06-1.41-1.41 1.06-1.06zm9.37 9.37l1.41 1.41-1.06 1.06-1.41-1.41 1.06-1.06zM3.05 11.01l1.06 1.06-1.41 1.41-1.06-1.06 1.41-1.41zm9.9-9.9l1.06 1.06-1.41 1.41-1.06-1.06 1.41-1.41z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M6.2 1.4a6.5 6.5 0 108.4 8.4A5.2 5.2 0 016.2 1.4z" />
    </svg>
  );
}
