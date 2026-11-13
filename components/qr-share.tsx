"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImage({
  value,
  size = 148,
  className,
  alt = "QR code",
}: {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale QR while the next data URL generates
    setDataUrl(null);
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b3d3a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`glass-tile animate-pulse ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={`rounded-lg border border-border-soft bg-white p-1 ${className ?? ""}`}
    />
  );
}

/** Compact share block: QR + copy actions for a join/invite URL. */
export function LinkSharePanel({
  title,
  hint,
  url,
  size = 132,
}: {
  title: string;
  hint?: string;
  url: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="glass-inset flex flex-col items-center gap-2 rounded-[var(--radius-control)] px-3 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-meta">
        {title}
      </div>
      <QrCodeImage value={url} size={size} alt={title} />
      {hint ? <p className="text-[11px] leading-snug text-muted">{hint}</p> : null}
      <button
        type="button"
        className="btn btn-ghost h-8 w-full px-2 text-[11px]"
        onClick={() => void copy()}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      <p className="max-w-[11rem] break-all font-mono text-[9px] leading-snug text-meta">
        {url}
      </p>
    </div>
  );
}

export function joinUrl(code: string, origin = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origin}/join/${encodeURIComponent(code)}`;
}
