"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calls `load` now and then every `intervalMs` while the tab is visible (paused when
 * hidden, refreshed at once when it comes back). Overlapping calls are skipped, and the
 * running request is aborted on unmount. `load` must be stable (useCallback): a new
 * `load` restarts the polling at once.
 */
export function usePolling(load: (signal: AbortSignal) => Promise<void>, intervalMs: number) {
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const tick = async () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      try {
        await load(controller.signal);
        if (!controller.signal.aborted) setUpdatedAt(Date.now());
      } catch {
        /* the caller shows its own error; keep polling */
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      busy.current = false;
    };
  }, [load, intervalMs]);

  return updatedAt;
}

/** "Device" label from a browser user-agent string, e.g. "Chrome on Android". */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iPhone / iPad"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "Mac"
    : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

/** "just now", "12 s ago", "4 min ago", "2 h ago". */
export function ago(iso: string | number | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
