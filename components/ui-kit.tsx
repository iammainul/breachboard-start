"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  variant = "default",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  variant?: "default" | "player" | "admin";
}) {
  return (
    <div
      className={cn(
        "page-hero flash-card relative overflow-hidden px-5 py-4 sm:px-6 sm:py-5",
        variant === "player" && "page-hero-player",
        variant === "admin" && "page-hero-admin",
      )}
    >
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-wash px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-hover">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-[24px] font-bold tracking-tight text-fg sm:text-[27px]">{title}</h1>
          {description ? (
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-meta">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FormCard({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
  meta,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Shown beside the title when the card is collapsed. */
  meta?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const expanded = !collapsible || open;

  return (
    <div
      className={cn(
        "flash-card flex min-w-0 flex-col p-4 sm:p-5",
        expanded && "gap-3.5",
        className,
      )}
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 items-start gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold text-fg">{title}</h3>
            {open && description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
            {!open && meta ? (
              <p className="mt-0.5 font-mono text-[12px] text-meta">{meta}</p>
            ) : null}
          </div>
          <span
            className={cn(
              "mt-1 shrink-0 text-meta transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          >
            <ChevronGlyph />
          </span>
        </button>
      ) : (
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-fg">{title}</h3>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {description}
            </p>
          ) : null}
        </div>
      )}
      <div
        id={bodyId}
        hidden={!expanded}
        className={cn(
          "flex min-w-0 flex-col gap-3.5",
          !expanded && "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ChevronGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path d="M4.3 6.3a1 1 0 011.4 0L8 8.6l2.3-2.3a1 1 0 111.4 1.4l-3 3a1 1 0 01-1.4 0l-3-3a1 1 0 010-1.4z" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flash-card flex flex-col items-center px-6 py-9 text-center">
      {icon ? (
        <div className="glass-tile mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-wash text-primary">
          {icon}
        </div>
      ) : null}
      <p className="text-[16px] font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function FilterChips({
  items,
}: {
  items: { href: string; label: string; active?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            item.active
              ? "bg-primary text-primary-fg shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
              : "glass-tile text-muted hover:border-primary/30 hover:text-fg",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-fg-2">{label}</span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-snug text-meta">{hint}</span>
      ) : null}
    </label>
  );
}

export function DataTable({
  columns,
  rows,
  empty,
  columnClasses,
  columnWidths,
  dense = false,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty?: React.ReactNode;
  /** Optional per-column Tailwind classes. */
  columnClasses?: string[];
  /** Optional fixed widths (e.g. `110px`) — applied via colgroup for reliability. */
  columnWidths?: (string | undefined)[];
  dense?: boolean;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const useFixed = Boolean(columnWidths?.some(Boolean));
  return (
    <div className="flash-card overflow-hidden">
      <div className="glass-scroll overflow-x-auto">
        <table
          className={cn(
            "w-full min-w-[560px] text-left text-[13px]",
            useFixed && "table-fixed",
          )}
        >
          {useFixed ? (
            <colgroup>
              {columns.map((_, idx) => (
                <col
                  key={idx}
                  style={
                    columnWidths?.[idx]
                      ? { width: columnWidths[idx] }
                      : undefined
                  }
                />
              ))}
            </colgroup>
          ) : null}
          <thead className="border-b border-border-soft bg-[color-mix(in_oklab,var(--bg)_45%,transparent)] text-[11px] uppercase tracking-[0.06em] text-meta backdrop-blur-md">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col}
                  className={cn(
                    "px-4 font-semibold",
                    dense ? "py-1.5" : "py-2.5",
                    columnClasses?.[idx],
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, rowIdx) => (
              <tr
                key={rowIdx}
                className="glass-row border-b border-border-soft last:border-0"
              >
                {cells.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={cn(
                      "px-4 align-middle",
                      dense ? "py-1.5" : "py-2.5",
                      columnClasses?.[cellIdx],
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScenarioCard({
  href,
  title,
  meta,
  tags,
  updated,
  badge,
}: {
  href: string;
  title: string;
  meta: string[];
  tags?: string[];
  updated: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flash-card group relative block overflow-hidden px-5 py-3.5"
    >
      <div data-deco className="inset-y-3 left-0 w-1 rounded-r-full bg-primary/70" />
      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold text-fg">{title}</h3>
            {badge ? (
              <span className="chip chip-on shrink-0 text-[11px]">{badge}</span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          {tags && tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="chip chip-on text-[11px]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 text-[12px] text-meta">{updated}</span>
      </div>
    </Link>
  );
}

export function OrgCard({
  href,
  name,
  slug,
  sector,
  notes,
  stats,
}: {
  href?: string;
  name: string;
  slug: string;
  sector: string;
  notes?: string;
  stats: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="glass-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-wash text-[14px] font-bold text-primary-hover">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[16px] font-semibold">{name}</div>
            <span className="chip shrink-0">{sector}</span>
          </div>
          <p className="mt-0.5 font-mono text-[12px] text-meta">{slug}</p>
        </div>
      </div>
      {notes ? <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{notes}</p> : null}
      <p className="mt-2.5 text-[12px] font-medium text-meta">{stats}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="flash-card group block px-5 py-3.5">
        {inner}
      </Link>
    );
  }
  return <div className="flash-card px-5 py-3.5">{inner}</div>;
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 2L4 5v6c0 5.25 3.75 9 8 10 4.25-1 8-4.75 8-10V5l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
