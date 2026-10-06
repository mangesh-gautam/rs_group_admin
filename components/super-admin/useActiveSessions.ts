"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ActiveSession } from "@/lib/auth/types";

const POLL_MS = 30_000;

/** Loads GET /api/super-admin/sessions/active and refreshes it every 30 s. */
export function useActiveSessions() {
  const { authFetch } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      setLoading(true);
      authFetch<{ sessions: ActiveSession[] }>("/api/super-admin/sessions/active", {
        signal: controller.signal,
      })
        .then(
          (res) => {
            setSessions(res.sessions);
            setError(null);
            setUpdatedAt(Date.now());
          },
          (err) => {
            if ((err as Error).name !== "AbortError") setError(errorMessage(err));
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [authFetch, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { sessions, error, loading, updatedAt, reload };
}
