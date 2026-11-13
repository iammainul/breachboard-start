"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceOrg } from "@/components/workspace-org";
import { cn } from "@/lib/cn";

export function WorkspaceOrgPicker() {
  const { organizations, selectedOrgId, selectedOrg, setSelectedOrgId } =
    useWorkspaceOrg();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

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

  if (organizations.length === 0) return null;

  return (
    <div className="px-3 pb-1 pt-1" ref={rootRef}>
      <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-meta">
        Workspace
      </div>
      <div className="relative z-40" ref={triggerRef}>
        <div
          className={cn(
            "glass-tile flex items-center",
            open && "border-primary/40 bg-hover",
          )}
        >
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary">
              <OrgGlyph />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-meta">
                Organization
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[13px] font-semibold",
                  selectedOrg ? "text-fg" : "text-muted",
                )}
              >
                {selectedOrg?.name ?? "Select organization"}
              </span>
            </span>
          </button>
          {selectedOrg ? (
            <button
              type="button"
              aria-label="Clear organization"
              title="Clear organization"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              onClick={() => {
                setSelectedOrgId(null);
                setOpen(false);
              }}
            >
              <ClearGlyph />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen((v) => !v)}
            className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center text-meta"
          >
            <span className={cn("transition-transform", open && "rotate-180")}>
              <ChevronGlyph />
            </span>
          </button>
        </div>

        {open && typeof document !== "undefined"
          ? createPortal(
              <ul
                ref={menuRef}
                id={listId}
                role="listbox"
                aria-label="Working organization"
                className="workspace-org-menu fixed z-[80] max-h-56 overflow-y-auto py-1"
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  width: menuPos.width,
                }}
              >
                {organizations.map((org) => {
                  const active = org.id === selectedOrgId;
                  return (
                    <li key={org.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-[13px] transition-colors"
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          setOpen(false);
                        }}
                      >
                        {org.name}
                      </button>
                    </li>
                  );
                })}
              </ul>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}

function OrgGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M2 2h5v12H2V2zm7 4h5v8H9V6zM3 4h3v2H3V4zm0 3h3v2H3V7zm7 2h3v2H10V9z" />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path d="M4.3 6.3a1 1 0 011.4 0L8 8.6l2.3-2.3a1 1 0 111.4 1.4l-3 3a1 1 0 01-1.4 0l-3-3a1 1 0 010-1.4z" />
    </svg>
  );
}

function ClearGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path d="M3.3 3.3a1 1 0 011.4 0L8 6.6l3.3-3.3a1 1 0 111.4 1.4L9.4 8l3.3 3.3a1 1 0 01-1.4 1.4L8 9.4l-3.3 3.3a1 1 0 01-1.4-1.4L6.6 8 3.3 4.7a1 1 0 010-1.4z" />
    </svg>
  );
}
