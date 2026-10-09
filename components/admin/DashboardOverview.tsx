"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { RecentAccounts } from "@/components/open-account/RecentAccounts";
import { StatCards, type Stat } from "@/components/open-account/StatCards";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime, officeLabel } from "@/lib/auth/types";
import type { Dashboard } from "@/lib/dashboard/types";

const money = (value: string) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(value));

/** Shared financial overview for the dashboard and registration sidebar. */
export function DashboardOverview() {
  const { authFetch, user } = useAuth();
  const [version, setVersion] = useState(0);
  const key = `${user?.id ?? ""}|${version}`;
  const [result, setResult] = useState<{ key: string; data: Dashboard | null; error: string | null }>({ key: "", data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    authFetch<Dashboard>("/api/admin/dashboard/stats", { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data, error: null }); },
      (err) => { if (!controller.signal.aborted) setResult({ key, data: null, error: errorMessage(err) }); },
    );
    return () => controller.abort();
  }, [authFetch, key]);

  const loading = result.key !== key;
  const data = !loading ? result.data : null;
  const stats: Stat[] = data ? [
    { label: "Total Members", value: data.summary.totalMembers.toLocaleString("en-IN"), icon: "users", tone: "green" },
    { label: "Total Deposits", value: money(data.summary.totalDeposits), icon: "download", tone: "blue" },
    { label: "Total Withdrawals", value: money(data.summary.totalWithdrawals), icon: "upload", tone: "orange" },
    { label: "Current Balances", value: money(data.summary.totalBalance), icon: "wallet", tone: "purple" },
    { label: "Interest Credited", value: money(data.summary.totalInterest), icon: "zap", tone: "green" },
    { label: "New Members This Month", value: String(data.thisMonth.newMembers), icon: "userPlus", tone: "blue" },
  ] : [];

  return (
    <section className="space-y-4" aria-label="Account overview" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-navy">Account Overview</h2>
          <p className="text-xs text-slate-500">
            {user?.role === "SUPER_ADMIN" ? "All offices" : user?.office ? officeLabel(user.office) : "No office assigned"}
            {data && ` · Updated ${formatDateTime(data.generatedAt)}`}
          </p>
        </div>
        <button type="button" onClick={() => setVersion((v) => v + 1)} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-brand hover:bg-slate-50 disabled:opacity-50">
          <Icon name="refresh" className="size-4" /> Refresh
        </button>
      </div>
      {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading account overview…</p>}
      {!loading && result.error && <Alert tone="error">{result.error} Use Refresh to try again.</Alert>}
      {data && <>
        <StatCards stats={stats} />
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-navy">This Month · {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${data.month}-01T00:00:00+05:30`))}</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Deposits</dt><dd className="font-semibold text-navy">{money(data.thisMonth.deposits)}</dd></div>
            <div><dt className="text-xs text-slate-500">Withdrawals</dt><dd className="font-semibold text-navy">{money(data.thisMonth.withdrawals)}</dd></div>
            <div><dt className="text-xs text-slate-500">Interest Credited</dt><dd className="font-semibold text-navy">{money(data.thisMonth.interest)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Daily: {data.accountTypes.daily} · Weekly: {data.accountTypes.weekly} · Monthly: {data.accountTypes.monthly}</p>
          <p className="mt-1 text-xs text-slate-500">Deposits include opening amounts and exclude interest. Current balances include credited interest and deduct withdrawals.</p>
        </div>
        <RecentAccounts accounts={data.recentAccounts} />
      </>}
    </section>
  );
}
