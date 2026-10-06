"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Office } from "@/lib/auth/types";

/** Loads GET /api/super-admin/offices (active offices first). */
export function useOffices() {
  const { authFetch } = useAuth();
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<Office[]>("/api/super-admin/offices", { signal: controller.signal }).then(
      (list) => {
        setOffices(list);
        setError(null);
      },
      (err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      },
    );
    return () => controller.abort();
  }, [authFetch, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { offices, error, loading: offices === null && !error, reload };
}
