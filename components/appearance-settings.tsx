"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { THEME_OPTIONS, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-fg">
          Colour field
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Pitch Obsidian is the default ops desk. Toxic Phosphor Day is for
          daytime briefs. Both use liquid glass. The sun/moon control in the
          sidebar (and on the login screen) switches instantly. Preference key:{" "}
          <code className="font-mono text-[12px] text-primary">breachboard-theme</code>
        </p>
      </div>

      <ul className="flash-card divide-y divide-border-soft overflow-hidden">
        {THEME_OPTIONS.map((opt) => {
          const selected = theme === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => setTheme(opt.id as ThemeId)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors",
                  selected ? "bg-primary-wash" : "hover:bg-hover",
                )}
              >
                <span
                  className="flex h-10 w-16 shrink-0 overflow-hidden border border-border-soft"
                  aria-hidden
                >
                  <span className="w-1/3" style={{ background: opt.preview.bg }} />
                  <span className="w-1/3" style={{ background: opt.preview.card }} />
                  <span
                    className="w-1/3"
                    style={{ background: opt.preview.primary }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-fg">
                      {opt.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-meta">
                      {opt.audience}
                    </span>
                    {selected ? (
                      <span className="chip chip-on text-[10px]">Active</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {opt.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] text-muted">
        Full identity, tokens, and product lockups live on the{" "}
        <Link href="/brand" className="font-semibold text-primary hover:underline">
          brand spec
        </Link>
        .
      </p>
    </div>
  );
}
