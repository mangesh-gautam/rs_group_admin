"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatAadhaar, formatAmount, type KycAccount, type KycPage } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { KycDialog } from "./KycDialog";
import { KycDocState, KycStatusBadge } from "./KycStatusBadge";

type Tab = "ALL" | "SUBMITTED" | "PENDING" | "REJECTED";
const TABS: { id: Tab; label: string; count: (c: NonNullable<KycPage["counts"]>) => number }[] = [
  { id: "ALL", label: "All", count: (c) => c.pending + c.submitted + c.rejected },
  { id: "SUBMITTED", label: "Awaiting approval", count: (c) => c.submitted },
  { id: "PENDING", label: "Documents missing", count: (c) => c.pending },
  { id: "REJECTED", label: "Rejected", count: (c) => c.rejected },
];
const PAGE_SIZE = 20;

/**
 * KYC Verification: every account that is not KYC-verified (it can deposit
 * but not withdraw). Uploads waiting for approval come first; each row opens
 * the KYC dialog to upload the missing documents or approve / reject them.
 */
export function KycList() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<KycPage | null>(null);
  const [counts, setCounts] = useState<KycPage["counts"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<KycAccount | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (tab !== "ALL") params.set("status", tab);
    if (q) params.set("q", q);
    authFetch<KycPage>(`/api/customers/kyc?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); if (d.counts) setCounts(d.counts); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, tab, q, page, version]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <Icon name="shieldCheck" className="size-6 text-brand" /> KYC Verification
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Accounts opened without PAN or Aadhaar, or with documents to approve. They can deposit, but cannot withdraw until KYC is verified.
        </p>
      </div>

      {done && <Alert tone="success">{done}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="KYC status">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.id ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"}`}>
              {t.label}
              {counts && <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-slate-100"}`}>{t.count(counts)}</span>}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, account no. or mobile"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">PAN</th>
              <th className="px-4 py-3 font-medium">Aadhaar</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data && !error && Array.from({ length: 4 }, (_, i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-6 rounded" /></td></tr>
            ))}
            {data?.items.map((a) => (
              <tr key={a.accountNo} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/admin/accounts/${a.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{a.name}</Link>
                  <p className="font-mono text-xs text-slate-500">{a.accountNo}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">+91 {a.mobileNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-slate-700">{a.panNo ?? "—"}</p>
                  <KycDocState number={a.panNo} verified={a.panKyc} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-slate-700">{a.aadhaarNo ? formatAadhaar(a.aadhaarNo) : "—"}</p>
                  <KycDocState number={a.aadhaarNo} verified={a.aadhaarKyc} />
                </td>
                <td className="px-4 py-3">
                  <KycStatusBadge status={a.status} />
                  {a.status === "SUBMITTED" && a.submittedAt && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {a.submittedVia === "CUSTOMER" ? "By the holder" : "At the desk"} · {formatDateTime(a.submittedAt)}
                    </p>
                  )}
                  {a.status === "REJECTED" && a.remarks && <p className="mt-1 max-w-56 text-[11px] text-red-600">{a.remarks}</p>}
                </td>
                <td className="px-4 py-3 text-right font-medium text-navy">{formatAmount(a.balance)}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setOpen(a)}
                    className={`h-9 rounded-lg px-3.5 text-xs font-medium whitespace-nowrap ${
                      a.status === "SUBMITTED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-brand text-white hover:bg-brand-dark"}`}>
                    {a.status === "SUBMITTED" ? "Review documents" : "Complete KYC"}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                {q ? "No account matches this search." : "No accounts here — every account in this list has completed KYC."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pages} · {data.total} accounts</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg border border-slate-200 bg-white px-4 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg border border-slate-200 bg-white px-4 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {open && (
        <KycDialog
          account={open}
          onClose={() => setOpen(null)}
          onDone={(r) => {
            setDone(
              r.status === "VERIFIED"
                ? `KYC verified for ${open.name} — withdrawals are now allowed.`
                : r.status === "SUBMITTED"
                  ? `Documents of ${open.name} sent for approval.`
                  : r.status === "REJECTED"
                    ? `Documents of ${open.name} rejected.`
                    : `Saved for ${open.name}. ${r.panKyc ? "Aadhaar" : "PAN"} is still needed.`,
            );
            setOpen(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
