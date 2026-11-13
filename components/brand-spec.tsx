"use client";

import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";
import { THEME_OPTIONS, type ThemeId } from "@/lib/themes";

const DARK_TOKENS = [
  { name: "--bg", hex: "#0B0F0D", role: "Pitch Obsidian" },
  { name: "--surface", hex: "#121815", role: "CRT Surface" },
  { name: "--fg", hex: "#F0F8F4", role: "High-vis text" },
  { name: "--muted", hex: "#80988C", role: "Dim telemetry" },
  { name: "--border", hex: "#1F2E26", role: "Matrix border" },
  { name: "--accent", hex: "#00FF66", role: "Toxic Phosphor" },
  { name: "--on-accent", hex: "#0B0F0D", role: "Ink on accent" },
  { name: "--signal", hex: "#CCFF00", role: "Voltage amber" },
  { name: "--success", hex: "#00FF66", role: "Active status" },
  { name: "--warn", hex: "#CCFF00", role: "Caution status" },
  { name: "--danger", hex: "#FF3366", role: "Threat breach" },
] as const;

const LIGHT_TOKENS = [
  { name: "--bg", hex: "#F0F8F4", role: "Cool paper phosphor" },
  { name: "--surface", hex: "#FFFFFF", role: "Pure surface card" },
  { name: "--fg", hex: "#0B0F0D", role: "Pitch text" },
  { name: "--muted", hex: "#4A6658", role: "Secondary text" },
  { name: "--border", hex: "#CCE0D8", role: "Clean border" },
  { name: "--accent", hex: "#008833", role: "Deepened phosphor" },
  { name: "--on-accent", hex: "#FFFFFF", role: "White on CTA" },
  { name: "--signal", hex: "#77AA00", role: "Voltage day" },
  { name: "--success", hex: "#008833", role: "Active status" },
  { name: "--warn", hex: "#77AA00", role: "Caution status" },
  { name: "--danger", hex: "#D01140", role: "Threat breach" },
] as const;

const RULES = [
  "The Breachboard mark is a rounded square with a B and a blue status dot. Do not use a parent-brand reticle.",
  "Pitch Obsidian (#0B0F0D) is the default field; Toxic Phosphor Day is the daytime counterpart.",
  "Surfaces are always elite liquid glass. No brutalist terminal option.",
  "Put custom glass classes in @layer components so Tailwind utilities still win.",
  "Fill the width (content max 1680px). Section gap 20px. Prefer columns over a tall stack.",
  "Documents inherit the active theme; prefer mono for evidence lines (hashes, IPs, timestamps).",
  "Persist data-theme (dark | light) as breachboard-theme. Default remains dark.",
  "Interaction states: empty (secondary action + disabled export), loading (aria-busy + spinner), error (role=alert + aria-invalid fields with --danger).",
  "Respect prefers-reduced-motion.",
] as const;

const GLASS_CLASSES = [
  { name: ".flash-card", use: "Primary frosted panel — rim, sheen, blur, shadow" },
  { name: ".glass-chrome", use: "Accent-tinted toolbar / hero" },
  { name: ".glass-dock", use: "Full-height column; scroll inside" },
  { name: ".glass-rail", use: "App sidebar" },
  { name: ".glass-header", use: "Sticky bar over scrolling content" },
  { name: ".glass-inset", use: "Recessed well (callouts, paste boxes)" },
  { name: ".glass-tile", use: "Small inner tile" },
  { name: ".glass-row", use: "List row; data-active for selection" },
  { name: ".app-canvas", use: "Field + phosphor glow + dot grid" },
] as const;

export function BrandSpec() {
  const { theme, setTheme } = useTheme();
  const tokens = theme === "light" ? LIGHT_TOKENS : DARK_TOKENS;

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 sm:py-10">
      <header className="flash-card glass-chrome sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <BrandLockup subtitle="Brand spec · living" />
        <div className="flex flex-wrap items-center gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id as ThemeId)}
              className={cn(
                "btn h-9 px-3 font-mono text-[11px] uppercase tracking-[0.08em]",
                theme === opt.id ? "btn-primary" : "btn-ghost",
              )}
            >
              {opt.id}
            </button>
          ))}
        </div>
      </header>

      <section className="flash-card relative overflow-hidden p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
          Breachboard
        </p>
        <h1 className="mt-3 max-w-3xl text-[36px] font-bold leading-[1.05] tracking-tight sm:text-[48px]">
          Live exercise board
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Plan scenarios, facilitate sessions, and capture decisions. Dark Pitch
          Obsidian is the default field; Toxic Phosphor Day is the daytime
          counterpart. Surfaces are always elite liquid glass. The portable
          cookbook for other apps is{" "}
          <code className="font-mono text-[13px] text-primary">design/DESIGN.md</code>.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <BrandMark className="h-16 w-16 text-fg" />
          <div>
            <div className="font-[family-name:var(--font-display)] text-[22px] font-bold">
              Breachboard
            </div>
            <div className="text-[13px] text-muted">Live exercise workspace</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-meta">
          Tokens · {theme === "light" ? "Toxic Phosphor Day" : "Pitch Obsidian"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((token) => (
            <div
              key={token.name}
              className="glass-inset flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5"
            >
              <span
                className="h-10 w-10 shrink-0 border border-border-soft"
                style={{ background: token.hex }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-mono text-[12px] text-fg">{token.name}</span>
                <span className="block font-mono text-[11px] text-primary">{token.hex}</span>
                <span className="block text-[12px] text-muted">{token.role}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flash-card p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            Typography
          </p>
          <h3 className="mt-3 text-[32px] font-bold tracking-tight">Space Grotesk</h3>
          <p className="mt-2 text-[15px] leading-relaxed">
            IBM Plex Sans for body copy — readable at ops density, no decorative chrome.
          </p>
          <p className="mt-4 font-mono text-[13px] text-signal">
            IBM Plex Mono — 192.168.4.12 · CVE-2024-3400
          </p>
        </div>
        <div className="flash-card p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            Interaction
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary">
              Primary CTA
            </button>
            <button type="button" className="btn btn-ghost">
              Secondary
            </button>
            <button type="button" className="btn btn-ghost" disabled>
              Export disabled
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="status-pill" data-status="live">
              Active
            </span>
            <span className="status-pill" data-status="draft">
              Caution
            </span>
            <span className="chip">Empty queue</span>
          </div>
          <p role="alert" className="mt-4 border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            Threat breach — aria-invalid fields use --danger.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-meta">
          Glass classes
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GLASS_CLASSES.map((item) => (
            <div key={item.name} className="glass-inset px-3 py-2.5">
              <div className="font-mono text-[12px] text-primary">{item.name}</div>
              <p className="mt-0.5 text-[12px] text-muted">{item.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flash-card p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
          Visual rules
        </p>
        <ol className="mt-4 grid gap-3 text-[13px] leading-relaxed text-muted sm:grid-cols-2">
          {RULES.map((rule, index) => (
            <li key={rule} className="flex gap-3">
              <span className="font-mono text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-meta">
          Lockups
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <figure className="border border-border bg-[#0B0F0D] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/breachboard-logo.png"
              alt="Breachboard wordmark"
              className="w-full"
            />
            <figcaption className="mt-2 font-mono text-[11px] text-[#80988C]">
              breachboard-logo.png
            </figcaption>
          </figure>
          <figure className="flex items-center justify-center border border-border bg-[#F0F8F4] p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/breachboard-mark.png"
              alt="Breachboard mark"
              className="h-28 w-28 object-contain"
            />
            <figcaption className="mt-2 font-mono text-[11px] text-[#4A6658]">
              breachboard-mark.png
            </figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
