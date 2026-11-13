"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { rankLabel } from "@/lib/game-score";
import { formatClock, remainingSeconds } from "@/lib/session-clock";
import { QrCodeImage, joinUrl } from "@/components/qr-share";

export function runStatusLabel(status: string): string {
  if (status === "draft") return "Prep";
  if (status === "live") return "Live";
  if (status === "closed") return "Closed";
  if (status === "archived") return "Archived";
  return status;
}

export function StatusBadge({ status }: { status: string }) {
  const live = status === "live";
  return (
    <span className="status-pill" data-status={status}>
      {live ? (
        <span className="pulse-live h-2 w-2 rounded-full bg-primary" aria-hidden />
      ) : null}
      {runStatusLabel(status)}
    </span>
  );
}

export function InjectProgress({
  injects,
  currentInjectId,
}: {
  injects: { id: string; sequence: number; title?: string }[];
  currentInjectId: string | null | undefined;
}) {
  if (injects.length === 0) return null;
  const currentIdx = injects.findIndex((i) => i.id === currentInjectId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-muted">Mission progress</span>
        <span className="font-mono tabular-nums text-meta">
          {currentIdx >= 0 ? currentIdx + 1 : 0}/{injects.length} injects
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${currentIdx >= 0 ? ((currentIdx + 1) / injects.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="flex gap-1">
        {injects.map((inject, idx) => {
          const done = currentIdx > idx;
          const active = inject.id === currentInjectId;
          return (
            <div
              key={inject.id}
              title={inject.title}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                done && "bg-primary",
                active && "bg-primary/60 ring-2 ring-primary/30",
                !done && !active && "bg-hover",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export const DISCUSS_TIMER_LABEL = "Time remaining";
export const DISCUSS_TIMER_CAPTION = "Answering opens automatically";
export const DISCUSS_PHASE_HINT =
  "Discuss with your squad — questions unlock when this timer hits zero.";

export function InjectCountdown({
  seconds,
  injectId,
  active,
  startedAt,
  large,
  onExpired,
  label = "Time left",
  caption,
}: {
  seconds: number;
  injectId: string;
  active: boolean;
  /** ISO timestamp from server — shared room clock (ADR-002) */
  startedAt?: string | null;
  large?: boolean;
  /** Fired once when the shared clock hits zero (reload — server owns the phase flip). */
  onExpired?: () => void;
  label?: string;
  /** What happens at zero. Displayed while counting and when expired. */
  caption?: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(startedAt, seconds),
  );
  const onExpiredRef = useRef(onExpired);
  const expiredKey = useRef<string | null>(null);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    const tick = () => setRemaining(remainingSeconds(startedAt, seconds));
    tick();
    if (!active) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [injectId, seconds, active, startedAt]);

  useEffect(() => {
    if (!active || remaining > 0) {
      if (remaining > 0) expiredKey.current = null;
      return;
    }
    const key = `${injectId}:${startedAt ?? ""}`;
    if (expiredKey.current === key) return;
    expiredKey.current = key;
    onExpiredRef.current?.();
  }, [active, remaining, injectId, startedAt]);

  const urgent = active && remaining <= 60 && remaining > 0;
  const expired = active && remaining === 0;
  const pct = seconds > 0 ? (remaining / seconds) * 100 : 0;

  return (
    <div
      role="timer"
      aria-label={
        caption
          ? `${label} ${formatClock(remaining)}. ${caption}`
          : `${label} ${formatClock(remaining)}`
      }
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-control)] px-4 py-2.5",
        large && "px-6 py-4",
        urgent && "border border-warn/45 bg-warn/10",
        expired && "border border-danger/40 bg-danger/10",
        !urgent && !expired && "glass-tile",
      )}
    >
      <div
        className={cn(
          "font-semibold uppercase tracking-[0.1em] text-meta",
          large ? "text-[12px]" : "text-[10px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono font-bold leading-none tabular-nums tracking-tight",
          large ? "text-[48px]" : "text-[28px]",
          urgent && "text-warn",
          expired && "text-danger",
        )}
      >
        {formatClock(remaining)}
      </div>
      <div className={cn("progress-track mt-2 w-full", large && "h-2")}>
        <div
          className={cn("progress-fill", urgent && "bg-warn", expired && "bg-danger")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption ? (
        <p
          className={cn(
            "mt-2 max-w-[16rem] text-center font-medium leading-snug",
            large ? "text-[13px]" : "text-[12px]",
            expired ? "text-danger" : "text-fg-2",
          )}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function PointsChip({ points, large }: { points: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary-wash font-semibold text-primary-hover",
        large ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-[11px]",
      )}
    >
      <StarIcon className={large ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {points} pts
    </span>
  );
}

export function QuestCard({
  roleName,
  prompt,
  points,
  answered,
  cue,
  viewOnly,
}: {
  roleName: string;
  prompt: string;
  points?: number;
  answered?: boolean;
  cue?: string;
  viewOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "quest-card rounded-[var(--radius-control)] px-4 py-3",
        answered
          ? "border border-primary/30 bg-primary-wash/50"
          : "glass-inset",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-hover">
          {roleName}
        </div>
        {viewOnly ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-meta">
            View only
          </span>
        ) : typeof points === "number" ? (
          <PointsChip points={points} />
        ) : null}
      </div>
      <p className="mt-1.5 text-[14px] font-medium leading-snug text-fg">{prompt}</p>
      {answered && !viewOnly ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-success">
          <CheckIcon className="h-3.5 w-3.5" />
          Response logged
        </div>
      ) : null}
      {cue ? <p className="mt-1.5 text-[12px] text-muted">Facilitator cue: {cue}</p> : null}
    </div>
  );
}

export function ScorePanel({
  earned,
  total,
  answersCount,
  injectCount,
}: {
  earned: number;
  total: number;
  answersCount: number;
  injectCount: number;
}) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  const rank = rankLabel(earned, total);

  return (
    <div className="score-panel rounded-[var(--radius)] border border-primary/20 bg-gradient-to-br from-primary-wash to-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-hover">
            Your score
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-fg">
              {earned}
            </span>
            <span className="text-[14px] text-muted">/ {total} pts</span>
          </div>
        </div>
        <div className="glass-tile px-3 py-1.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-meta">
            Rank
          </div>
          <div className="mt-0.5 text-[15px] font-bold text-primary">{rank}</div>
        </div>
      </div>
      <div className="progress-track mt-2.5">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-muted">
        <span>
          {answersCount} {answersCount === 1 ? "response" : "responses"}
        </span>
        <span>{injectCount} injects in scenario</span>
      </div>
    </div>
  );
}

export function TechniqueChip({ id }: { id: string }) {
  return (
    <span className="glass-inset inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] text-fg-2">
      {id}
    </span>
  );
}

export function JoinCodeBadge({
  code,
  size = "default",
  hint,
}: {
  code: string;
  /** compact = console chrome; display = present/stage; default = mid */
  size?: "default" | "display" | "compact";
  hint?: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [showQr, setShowQr] = useState(size !== "compact");
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const display = size === "display";
  const compact = size === "compact";
  const qrSize = display ? 180 : compact ? 88 : 128;

  const link = origin ? joinUrl(code, origin) : "";

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? code : link;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  if (compact) {
    return (
      <div className="join-code-badge flex shrink-0 items-center gap-3 rounded-[var(--radius-control)] border border-primary/25 bg-primary-wash px-3 py-2">
        {showQr && link ? (
          <QrCodeImage
            value={link}
            size={qrSize}
            alt={`Join QR for ${code}`}
          />
        ) : null}
        <div className="min-w-0 text-left">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-primary-hover">
            Squad code
          </div>
          <div className="font-mono text-[18px] font-bold tracking-[0.18em] text-fg">
            {code}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary-hover hover:bg-primary/15"
              onClick={() => void copy("code")}
            >
              {copied === "code" ? "Copied" : "Code"}
            </button>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary-hover hover:bg-primary/15"
              onClick={() => void copy("link")}
              disabled={!link}
            >
              {copied === "link" ? "Copied" : "Link"}
            </button>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary-hover hover:bg-primary/15"
              onClick={() => setShowQr((v) => !v)}
            >
              {showQr ? "Hide QR" : "QR"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`join-code-badge rounded-[var(--radius)] border border-primary/25 bg-primary-wash text-center ${
        display ? "px-5 py-4" : "px-5 py-3"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-hover">
        Squad code
      </div>
      <div
        className={`mt-1 font-mono font-bold tracking-[0.22em] text-fg ${
          display ? "text-[32px]" : "text-[24px]"
        }`}
      >
        {code}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-hover hover:bg-primary/15"
          onClick={() => void copy("code")}
        >
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-hover hover:bg-primary/15"
          onClick={() => void copy("link")}
          disabled={!link}
        >
          {copied === "link" ? "Link copied" : "Copy join link"}
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-hover hover:bg-primary/15"
          onClick={() => setShowQr((v) => !v)}
        >
          {showQr ? "Hide QR" : "Show QR"}
        </button>
      </div>
      {showQr && link ? (
        <div className="mt-2 flex justify-center">
          <QrCodeImage
            value={link}
            size={qrSize}
            alt={`Join QR for ${code}`}
          />
        </div>
      ) : null}
      {showQr ? (
        <p className="mt-2 text-[10px] text-muted">
          {hint ??
            "Scan or open the link to join this squad (name only — no account)."}
        </p>
      ) : null}
    </div>
  );
}

export function PresenceBadge({
  status,
  className,
}: {
  status: "online" | "waiting" | "left";
  className?: string;
}) {
  const label =
    status === "online"
      ? "Online"
      : status === "waiting"
        ? "Yet to join"
        : "Left";
  const dot =
    status === "online"
      ? "bg-success pulse-live"
      : status === "waiting"
        ? "bg-border"
        : "bg-danger/70";
  const text =
    status === "online"
      ? "text-success"
      : status === "waiting"
        ? "text-meta"
        : "text-danger";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${text} ${className ?? ""}`}
      title={label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function MissionCard({
  title,
  org,
  meta,
  status,
  href,
  progress,
  points,
  joinCode,
  imageSrc,
}: {
  title: string;
  org: string;
  meta?: string;
  status?: string;
  href: string;
  progress?: number;
  points?: { earned: number; total: number };
  joinCode?: string;
  imageSrc?: string | null;
}) {
  const live = status === "live";
  return (
    <Link href={href} className="mission-card group block h-full">
      <div
        className="flash-card flash-card-interactive relative h-full overflow-hidden px-5 py-3.5 pl-7"
        data-run={status}
      >
        {status ? (
          <span
            data-deco
            className={cn("mission-rail", live && "pulse-bar")}
            data-status={status}
            aria-hidden
          />
        ) : (
          <span data-deco className="mission-rail" data-status="draft" aria-hidden />
        )}
        {live ? (
          <span
            data-deco
            className="mission-pulse pulse-live inline-flex h-2.5 w-2.5 rounded-full bg-primary"
            aria-hidden
          />
        ) : null}
        <div className="flex items-start justify-between gap-3">
          {imageSrc ? (
            <div className="glass-tile hidden h-20 w-36 shrink-0 overflow-hidden sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt=""
                className="h-full w-full object-cover object-left"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg">{title}</div>
            <p className="mt-0.5 text-[13px] text-muted">
              {org}
              {joinCode ? (
                <>
                  {" · "}
                  <span className="join-code-inline font-mono text-[11px] font-semibold tracking-[0.12em] text-primary-hover">
                    {joinCode}
                  </span>
                </>
              ) : null}
              {meta ? ` · ${meta}` : ""}
            </p>
            {typeof progress === "number" ? (
              <div className="progress-track mt-2 max-w-xs">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {status ? <StatusBadge status={status} /> : null}
            {points && points.total > 0 ? (
              <span className="text-[12px] font-medium tabular-nums text-primary-hover">
                {points.earned}/{points.total} pts
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.92L8 10.27l-3.52 1.85.67-3.92-2.85-2.78 3.94-.57L8 1.5z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M3 8.5l3.5 3.5 6.5-7" />
    </svg>
  );
}
