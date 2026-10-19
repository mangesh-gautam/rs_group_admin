"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import type { AdminActivityPage, AdminActivityRow } from "@/lib/activity/types";
import { AdminHistory } from "./AdminHistory";

/** Super Admin → Admin Activity → one admin: who they are, all-time totals and the full history. */
export function AdminActivityDetail({ id, basePath = "/super-admin/admin-activity" }: { id: string; basePath?: string }) {
  const { authFetch } = useAuth();
  const adminId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  const [row, setRow] = useState<AdminActivityRow | null | undefined>(undefined); // null = not found
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminId === null) return undefined;
    const c = new AbortController();
    authFetch<AdminActivityPage>(`/api/admin/activity/admins?q=${adminId}&pageSize=100`, { signal: c.signal }).then(
      (d) => setRow(d.items.find((r) => r.admin.id === adminId) ?? null),
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => c.abort();
  }, [authFetch, adminId]);

  const back = (
    <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy">
      <Icon name="chevronRight" className="size-4 rotate-180" /> All admins
    </Link>
  );
  if (adminId === null || row === null) {
    return <div className="space-y-4">{back}<Alert tone="error">Admin not found.</Alert></div>;
  }
  const a = row?.admin;

  return (
    <div className="space-y-5">
      {back}
      {error && <Alert tone="error">{error}</Alert>}
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        {!a ? <div className="h-16 w-64 animate-pulse rounded-lg bg-slate-100" /> : (
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand">{a.name.trim().charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-navy">
                {a.name}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                </span>
                {a.role === "SUPER_ADMIN" && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Super Admin</span>}
              </h1>
              <p className="font-mono text-xs text-slate-500">Admin ID {a.id} · {a.username}{a.employeeId ? ` · Employee ${a.employeeId}` : ""}</p>
              <p className="text-xs text-slate-500">
                {a.office ? `${a.office.name}${a.office.city ? `, ${a.office.city}` : ""}` : "All offices"}
                {a.lastLoginAt ? ` · last sign-in ${formatDateTime(a.lastLoginAt)}` : ""}
              </p>
            </div>
          </div>
        )}
        {row && (
          <dl className="grid grid-cols-4 gap-4 text-center">
            {([["Transactions", row.allTime.transactions], ["Deposits", row.allTime.deposits], ["Withdrawals", row.allTime.withdrawals],
              ["Accounts opened", row.allTime.accountsCreated]] as const).map(([label, v]) => (
              <div key={label}>
                <dt className="text-[11px] text-slate-500">{label}</dt>
                <dd className="text-xl font-bold text-navy tabular-nums">{v}</dd>
              </div>
            ))}
            <p className="col-span-4 -mt-2 text-[11px] text-slate-400">all time</p>
          </dl>
        )}
      </section>
      {a && a.status !== "ACTIVE" && (
        <Alert tone="info">This admin is {a.status.toLowerCase()}. Their history stays exactly as it was recorded.</Alert>
      )}
      <AdminHistory adminId={adminId} />
    </div>
  );
}
