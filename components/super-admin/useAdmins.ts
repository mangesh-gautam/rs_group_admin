"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { AccountStatus, AdminAccount } from "@/lib/auth/types";

type Result = { key: string; admins: AdminAccount[] | null; error: string | null };

/** Loads GET /api/super-admin/admins with optional status / search filters. */
export function useAdmins(filter: { status?: AccountStatus | ""; q?: string } = {}) {
  const { authFetch } = useAuth();
  const [version, setVersion] = useState(0);
  const status = filter.status ?? "";
  const q = (filter.q ?? "").trim();
  const key = `${status}|${q}|${version}`;
  const [result, setResult] = useState<Result>({ key: "", admins: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const query = params.size ? `?${params}` : "";

    authFetch<AdminAccount[]>(`/api/super-admin/admins${query}`, { signal: controller.signal }).then(
      (admins) => setResult({ key, admins, error: null }),
      (err) => {
        if ((err as Error).name === "AbortError") return;
        setResult((prev) => ({ key, admins: prev.admins, error: errorMessage(err) }));
      },
    );
    return () => controller.abort();
  }, [authFetch, status, q, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    // Previous rows stay visible while a new filter is loading.
    admins: result.admins,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    reload,
  };
}
