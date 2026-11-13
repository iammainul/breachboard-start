"use client";

import { useEffect, useState } from "react";

const FALLBACK = { visibleMs: 5000, hiddenMs: 16000 };

/** Loads org capacity poll cadence (20–100 concurrent users). */
export function useSessionPollIntervals() {
  const [intervals, setIntervals] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/capacity")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setIntervals({
          visibleMs: Number(json.sessionPollMs) || FALLBACK.visibleMs,
          hiddenMs: Number(json.sessionPollHiddenMs) || FALLBACK.hiddenMs,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return intervals;
}
