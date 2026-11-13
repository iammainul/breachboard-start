"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type GlassOption = { value: string; label: string };

export function GlassDropdown({
  label,
  options,
  value,
  onChange,
  multiple = false,
  placeholder = "Select",
  name,
  hint,
  disabled,
  emptyText = "Nothing to select",
}: {
  label: string;
  options: GlassOption[];
  value: string | string[];
  onChange?: (next: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  name?: string;
  hint?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  useLayoutEffect(() => {
    if (!open) return;
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    setMenuPos({ top: box.bottom + 6, left: box.left, width: box.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const box = triggerRef.current?.getBoundingClientRect();
      if (!box) return;
      setMenuPos({ top: box.bottom + 6, left: box.left, width: box.width });
    }
    place();
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = (() => {
    if (selected.length === 0) return placeholder;
    const labels = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
    if (labels.length === 0) return placeholder;
    if (labels.length === 1) return labels[0];
    return `${labels.length} selected`;
  })();

  function pick(nextValue: string) {
    if (multiple) {
      const next = selected.includes(nextValue)
        ? selected.filter((id) => id !== nextValue)
        : [...selected, nextValue];
      onChange?.(next);
      return;
    }
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-1.5">
      {name
        ? selected.map((id) => (
            <input key={id} type="hidden" name={name} value={id} />
          ))
        : null}
      <div className="relative" ref={triggerRef}>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "glass-tile flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50",
            open && "border-primary/40 bg-hover",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-meta">
              {label}
            </span>
            <span
              className={cn(
                "mt-0.5 block truncate text-[13px] font-semibold",
                selected.length ? "text-fg" : "text-muted",
              )}
            >
              {summary}
            </span>
          </span>
          <span
            className={cn("shrink-0 text-meta transition-transform", open && "rotate-180")}
            aria-hidden
          >
            <ChevronGlyph />
          </span>
        </button>
      </div>
      {hint ? <p className="text-[12px] leading-snug text-muted">{hint}</p> : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-multiselectable={multiple || undefined}
              className="workspace-org-menu fixed z-[80] max-h-56 overflow-y-auto py-1"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-muted">{emptyText}</li>
              ) : (
                options.map((option) => {
                  const active = selected.includes(option.value);
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                        onClick={() => pick(option.value)}
                      >
                        {multiple ? (
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                              active
                                ? "border-primary bg-primary text-primary-fg"
                                : "border-border-soft text-transparent",
                            )}
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : null}
                        {option.label}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
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
