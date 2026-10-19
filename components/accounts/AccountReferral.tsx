"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { SponsorPicker } from "@/components/open-account/SponsorPicker";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { money } from "@/lib/deposits/types";
import { LEVEL_LABEL, rateLabel, type CommissionPage, type ReferralSummary } from "@/lib/referral/types";

const PAGE_SIZE = 10;

/**
 * Account page → Referral & Commission: the sponsor and upline (5 levels),
 * direct referrals, network size, and the commission ledger — what this
 * member EARNED from their downline's deposits, or what their own deposits
 * GENERATED for the upline. The Super Admin can change the sponsor.
 */
export function AccountReferral({ accountNo }: { accountNo: string }) {
  const { authFetch, user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [ledger, setLedger] = useState<CommissionPage | null>(null);
  const [direction, setDirection] = useState<"EARNED" | "GENERATED">("EARNED");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<ReferralSummary>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/referral`, { signal: controller.signal })
      .then(setSummary, (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); });
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ accountNo, direction, page: String(page), pageSize: String(PAGE_SIZE) });
    authFetch<CommissionPage>(`/api/deposits/commissions?${params}`, { signal: controller.signal })
      .then(setLedger, (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); });
    return () => controller.abort();
  }, [authFetch, accountNo, direction, page, version]);

  const pages = ledger ? Math.max(1, Math.ceil(ledger.total / ledger.pageSize)) : 1;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="users" className="size-5 text-brand" /> Referral &amp; Commission
        </h2>
        {summary && (
          <Link href={`/admin/referral-tree?root=${accountNo}`} className="flex items-center gap-1.5 rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft">
            <Icon name="users" className="size-4" /> View tree
          </Link>
        )}
        {summary && (
          <p className="text-xs text-slate-500">
            Earned <b className="text-emerald-700">{money(summary.commissionEarned)}</b> · generated for upline{" "}
            <b className="text-navy">{money(summary.commissionGenerated)}</b>
          </p>
        )}
      </div>

      {error && <div className="p-5"><Alert tone="error">{error}</Alert></div>}
      {!summary && !error && <div className="m-5 h-28 animate-pulse rounded-lg bg-slate-100 sm:m-6" />}

      {summary && (
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-3">
          {/* sponsor + upline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Sponsor &amp; upline</h3>
              {isSuperAdmin && !changing && (
                <button type="button" onClick={() => setChanging(true)} className="text-xs font-medium text-brand hover:underline">Change sponsor</button>
              )}
            </div>
            {summary.upline.length === 0 ? (
              <p className="text-sm text-slate-500">No sponsor — this account is at the top of its network.</p>
            ) : (
              <ol className="space-y-1.5">
                {summary.upline.map((u) => (
                  <li key={u.level} className="flex items-center gap-2 text-sm">
                    <span className="w-8 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[11px] font-semibold text-slate-600">L{u.level}</span>
                    <Link href={`/admin/accounts/${u.accountNo}`} className="min-w-0 truncate text-navy hover:text-brand hover:underline">{u.name}</Link>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{u.accountNo}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* downline */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Direct referrals ({summary.directReferrals.length}) · network {summary.networkSize}
            </h3>
            {summary.networkSize > 0 && (
              <p className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].filter((l) => summary.networkByLevel[l]).map((l) => (
                  <span key={l} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">L{l}: {summary.networkByLevel[l]}</span>
                ))}
              </p>
            )}
            {summary.directReferrals.length === 0 ? (
              <p className="text-sm text-slate-500">Has not sponsored anyone yet.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                {summary.directReferrals.map((r) => (
                  <li key={r.accountNo} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/accounts/${r.accountNo}`} className="truncate text-navy hover:text-brand hover:underline">{r.name}</Link>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{r.accountNo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* totals */}
          <dl className="grid grid-cols-2 gap-3 self-start">
            <div className="rounded-xl bg-emerald-50 p-3">
              <dt className="text-xs text-emerald-800">Commission earned</dt>
              <dd className="text-lg font-bold text-emerald-700 tabular-nums">{money(summary.commissionEarned)}</dd>
              <dd className="text-[11px] text-emerald-800">{summary.commissionEarnedCount} entries</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-600">Paid to upline</dt>
              <dd className="text-lg font-bold text-navy tabular-nums">{money(summary.commissionGenerated)}</dd>
              <dd className="text-[11px] text-slate-500">from this member&apos;s deposits</dd>
            </div>
          </dl>

          {changing && (
            <ChangeSponsor
              accountNo={accountNo}
              current={summary.sponsor}
              onCancel={() => setChanging(false)}
              onDone={() => { setChanging(false); setVersion((v) => v + 1); }}
            />
          )}
        </div>
      )}

      {/* ledger */}
      <div className="border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
          <div className="flex gap-1.5" role="tablist" aria-label="Commission direction">
            {(["EARNED", "GENERATED"] as const).map((d) => (
              <button key={d} type="button" role="tab" aria-selected={direction === d} onClick={() => { setDirection(d); setPage(1); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${direction === d ? "border-navy bg-navy text-white" : "border-slate-200 text-slate-600 hover:border-brand"}`}>
                {d === "EARNED" ? "Earned from downline" : "Paid to upline"}
              </button>
            ))}
          </div>
          {ledger && <span className="text-xs text-slate-500">{ledger.total} entries · net {money(ledger.totalAmount)}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm sm:min-w-[720px]">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">{direction === "EARNED" ? "From member" : "To sponsor"}</th>
                <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Level</th>
                <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Deposit</th>
                <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger?.items.map((c) => {
                const other = direction === "EARNED" ? c.source : c.beneficiary;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{formatDateTime(c.at)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/accounts/${other.accountNo}`} className="text-navy hover:text-brand hover:underline">{other.name}</Link>
                      <span className="block font-mono text-[11px] text-slate-400">{other.accountNo}</span>
                      <span className="block text-[11px] text-slate-500 sm:hidden">L{c.level} · {money(c.depositAmount)} deposit</span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-xs text-slate-700">L{c.level} · {LEVEL_LABEL[c.level]}</td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-xs">
                      <span className="font-mono text-slate-500">{c.receiptNo}</span>
                      <span className="block text-slate-700">{money(c.depositAmount)}</span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-xs text-slate-700">{rateLabel(c.commissionType, c.rate)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${Number(c.amount) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {Number(c.amount) < 0 ? "−" : "+"}{money(String(Math.abs(Number(c.amount))))}
                      {c.type === "REVERSAL" && <span className="block text-[10px] font-normal text-red-500">reversal</span>}
                    </td>
                  </tr>
                );
              })}
              {ledger && ledger.items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                  {direction === "EARNED" ? "No commission earned yet — it comes from deposits of members this account sponsored (up to 5 levels down)." : "This member's deposits haven't paid any commission yet."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {ledger && ledger.total > ledger.pageSize && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 text-xs text-slate-600">
            Page {page} of {pages}
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Super Admin: pick a new sponsor (or remove it) with a reason; the database refuses self-sponsoring and loops. */
function ChangeSponsor({ accountNo, current, onCancel, onDone }: {
  accountNo: string;
  current: ReferralSummary["sponsor"];
  onCancel: () => void;
  onDone: () => void;
}) {
  const { authFetch } = useAuth();
  const [sponsor, setSponsor] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (remove: boolean) => {
    if (!remove && (!sponsor || invalid)) { setError("Choose an existing account as the new sponsor."); return; }
    if (!reason.trim()) { setError("Write the reason for this change (kept in the audit log)."); return; }
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/sponsor`, {
        method: "PUT",
        body: { sponsorAccountNo: remove ? null : sponsor, reason: reason.trim() },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 lg:col-span-3">
      <p className="text-sm text-amber-900">
        <b>Change sponsor</b> · current: {current ? `${current.name} (${current.accountNo})` : "none"}. Commission already paid stays as it is; future deposits use the new network.
      </p>
      <SponsorPicker value={sponsor} onChange={(no, bad) => { setSponsor(no); setInvalid(bad); setError(null); }} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">Reason</span>
        <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="e.g. Wrong sponsor entered at opening" className={inputCls()} />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm text-navy hover:bg-slate-50">Cancel</button>
        {current && (
          <button type="button" disabled={busy} onClick={() => save(true)} className="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Remove sponsor</button>
        )}
        <button type="button" disabled={busy} onClick={() => save(false)} className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
          {busy ? "Saving…" : "Save new sponsor"}
        </button>
      </div>
    </div>
  );
}
