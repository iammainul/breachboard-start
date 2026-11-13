"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options<T> = {
  url: string;
  /** Full fetch interval when tab visible (ms) */
  intervalMs?: number;
  /** Slower interval when document.hidden */
  hiddenIntervalMs?: number;
  /** Map JSON → state; receive previous for merge */
  merge?: (prev: T | null, next: unknown, meta: { poll: boolean }) => T;
  /** When true after a poll merge, trigger a full (non-poll) reload */
  needsFullReload?: (prev: T | null, next: T, poll: boolean) => boolean;
  enabled?: boolean;
};

/**
 * Polls an endpoint with Page Visibility awareness and optional poll=1 lite fetches.
 */
export function usePollingResource<T>(options: Options<T>) {
  const {
    url,
    intervalMs = 4000,
    hiddenIntervalMs = 12000,
    merge,
    needsFullReload,
    enabled = true,
  } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef<T | null>(null);
  const loadingFull = useRef(false);

  const load = useCallback(
    async (poll: boolean) => {
      if (!poll && loadingFull.current) return;
      if (!poll) loadingFull.current = true;
      const sep = url.includes("?") ? "&" : "?";
      const target = poll ? `${url}${sep}poll=1` : url;
      try {
        const response = await fetch(target, {
          cache: "no-store",
          headers: poll ? { "X-Poll": "1" } : undefined,
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json.error ?? "Load failed");
          setLoading(false);
          return;
        }
        const prev = dataRef.current;
        const next = merge ? merge(prev, json, { poll }) : (json as T);
        dataRef.current = next;
        setData(next);
        setError(null);
        if (poll && needsFullReload?.(prev, next, true)) {
          loadingFull.current = true;
          const fullResponse = await fetch(url, { cache: "no-store" });
          const fullJson = await fullResponse.json();
          if (fullResponse.ok) {
            const fullNext = merge
              ? merge(next, fullJson, { poll: false })
              : (fullJson as T);
            dataRef.current = fullNext;
            setData(fullNext);
          } else {
            setError(fullJson.error ?? "Load failed");
          }
          loadingFull.current = false;
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
        if (!poll) loadingFull.current = false;
      }
    },
    [url, merge, needsFullReload],
  );

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial network synchronization
    void load(false);

    let timer: number | undefined;
    const schedule = () => {
      if (timer) window.clearInterval(timer);
      const ms = document.hidden ? hiddenIntervalMs : intervalMs;
      timer = window.setInterval(() => void load(true), ms);
    };
    schedule();

    const onVis = () => {
      if (!document.hidden) void load(true);
      schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, load, intervalMs, hiddenIntervalMs]);

  return { data, setData, error, setError, loading, reload: () => load(false) };
}
