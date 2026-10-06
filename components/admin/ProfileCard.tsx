"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABEL, formatDateTime, type AuthUser } from "@/lib/auth/types";

/** Profile from GET /api/auth/me (fresh from the server, not just the cached session). */
export function ProfileCard() {
  const { user: sessionUser, authFetch } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(sessionUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AuthUser>("/api/auth/me", { signal: controller.signal })
      .then(setUser)
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [authFetch]);

  if (!user) return null;

  const rows: [string, string][] = [
    ["Full Name", user.fullName],
    ["Username", user.username],
    ["Email", user.email],
    ["Mobile Number", user.mobileNumber],
    ["Employee / Admin ID", user.employeeId ?? "—"],
    ["Role", ROLE_LABEL[user.role]],
    ["Last Sign-in", formatDateTime(user.lastLoginAt)],
    ["Password Last Changed", formatDateTime(user.passwordChangedAt)],
  ];

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand">
            {user.fullName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold text-navy">{user.fullName}</p>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              {ROLE_LABEL[user.role]}
              {user.mobileVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <Icon name="check" className="size-3" strokeWidth={2.5} /> Mobile verified
                </span>
              )}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
              <dd className="mt-1 text-sm text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Link
        href={user.role === "SUPER_ADMIN" ? "/super-admin/settings" : "/admin/settings/security"}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
      >
        <Icon name="lock" className="size-4" /> Change password
      </Link>
    </div>
  );
}
