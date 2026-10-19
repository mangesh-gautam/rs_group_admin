"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon, type IconName } from "@/components/icons";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { money } from "@/lib/deposits/types";
import {
  TXN_STATUS,
  dayLabel,
  downloadCsv,
  istDate,
  istMonth,
  istTime,
  istToday,
  monthEnd,
  monthName,
  txnLabel,
  useDebounced,
  type ActivityAccountPage,
  type ActivityPeriod,
  type ActivityTransaction,
  type ActivityTransactionPage,
  type TxnStatus,
} from "@/lib/activity/types";

/** Which time the history covers (all IST). */
type Period =
  | { kind: "TODAY" }
  | { kind: "DAY"; day: string }
  | { kind: "MONTH"; month: string }
  | { kind: "RANGE"; from: string; to: string }
  | { kind: "ALL" };
type Tab = "transactions" | "accounts" | "breakdown";
const PAGE_SIZE = 25;

function bounds(p: Period): { from: string | null; to: string | null; label: string } {
  switch (p.kind) {
    case "TODAY": { const d = istToday(); return { from: d, to: d, label: `Today, ${dayLabel(d)}` }; }
    case "DAY": return { from: p.day, to: p.day, label: dayLabel(p.day) };
    case "MONTH": return { from: `${p.month}-01`, to: monthEnd(p.month), label: monthName(p.month) };
    case "RANGE": return { from: p.from || null, to: p.to || null, label: `${p.from ? dayLabel(p.from) : "Start"} – ${p.to ? dayLabel(p.to) : "today"}` };
    case "ALL": return { from: null, to: null, label: "Complete history" };
  }
}

/**
 * Transactions and accounts opened — of one admin (adminId) or of every admin (then the
 * admin can be searched by name or ID). Daily, monthly, custom range or complete history;
 * every total follows the filters. Super Admin only (the API refuses anyone else).
 */
export function AdminHistory({ adminId, accountsBase = "/super-admin/accounts" }: { adminId?: number; accountsBase?: string }) {
  const { authFetch } = useAuth();
  const [period, setPeriod] = useState<Period>({ kind: "TODAY" });
  const [tab, setTab] = useState<Tab>("transactions");
  const [type, setType] = useState<"" | "DEPOSIT" | "WITHDRAWAL">("");
  const [status, setStatus] = useState<"" | TxnStatus>("");
  const [search, setSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [accPage, setAccPage] = useState(1);
  const [txns, setTxns] = useState<ActivityTransactionPage | null>(null);
  const [accounts, setAccounts] = useState<ActivityAccountPage | null>(null);
  const [periods, setPeriods] = useState<ActivityPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const q = useDebounced(search.trim());
  const adminQ = useDebounced(adminSearch.trim());
  const range = useMemo(() => bounds(period), [period]);
  const group: "DAY" | "MONTH" | null = period.kind === "ALL" ? "MONTH" : period.kind === "MONTH" || period.kind === "RANGE" ? "DAY" : null;

  // a filter change starts that list again at page 1 (type / status only concern transactions)
  const baseKey = `${range.from}|${range.to}|${q}|${adminQ}`;
  const txKey = `${baseKey}|${type}|${status}`;
  const [keys, setKeys] = useState({ base: baseKey, tx: txKey });
  if (keys.tx !== txKey) {
    setKeys({ base: baseKey, tx: txKey });
    setTxPage(1);
    if (keys.base !== baseKey) setAccPage(1);
  }

  const params = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | null> = { adminId: adminId ? String(adminId) : null, admin: adminId ? null : adminQ || null,
      from: range.from, to: range.to, q: q || null, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return p;
  };

  const fail = (err: unknown) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); };

  // each list reloads only when its own filters change: transactions (also the totals) …
  useEffect(() => {
    const c = new AbortController();
    authFetch<ActivityTransactionPage>(`/api/admin/activity/transactions?${params({ type: type || null, status: status || null,
      page: String(txPage), pageSize: String(PAGE_SIZE) })}`, { signal: c.signal }).then((d) => { setTxns(d); setError(null); }, fail);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params() reads exactly these values
  }, [authFetch, adminId, adminQ, range.from, range.to, q, type, status, txPage]);

  // … accounts opened (also the count) …
  useEffect(() => {
    const c = new AbortController();
    authFetch<ActivityAccountPage>(`/api/admin/activity/accounts?${params({ page: String(accPage), pageSize: String(PAGE_SIZE) })}`,
      { signal: c.signal }).then(setAccounts, fail);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params() reads exactly these values
  }, [authFetch, adminId, adminQ, range.from, range.to, q, accPage]);

  // … and the day / month breakdown, only while it is shown
  useEffect(() => {
    if (!group || tab !== "breakdown") return undefined;
    const c = new AbortController();
    authFetch<{ items: ActivityPeriod[] }>(`/api/admin/activity/periods?${params({ q: null, admin: null, group })}`, { signal: c.signal })
      .then((d) => setPeriods(d.items), fail);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params() reads exactly these values
  }, [authFetch, adminId, range.from, range.to, group, tab]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      if (tab === "accounts") {
        const rows: ActivityAccountPage["items"] = [];
        for (let p = 1; ; p++) {
          const d = await authFetch<ActivityAccountPage>(`/api/admin/activity/accounts?${params({ page: String(p), pageSize: "100" })}`);
          rows.push(...d.items);
          if (p * 100 >= d.total) break;
        }
        downloadCsv(`accounts-opened-${range.from ?? "start"}-${range.to ?? "now"}.csv`, [
          ["Admin name", "Admin ID", "Username", "Account holder", "Account no.", "Created date (IST)", "Created time (IST)", "Opening amount", "KYC", "Account status", "Office"],
          ...rows.map((r) => [r.admin.name, r.admin.id, r.admin.username, r.account.holderName, r.account.accountNo, istDate(r.createdAt), istTime(r.createdAt),
            r.openingAmount, r.account.kycStatus, r.account.status, r.office.name]),
        ]);
      } else {
        const rows: ActivityTransaction[] = [];
        for (let p = 1; ; p++) {
          const d = await authFetch<ActivityTransactionPage>(`/api/admin/activity/transactions?${params({ type: type || null, status: status || null, page: String(p), pageSize: "100" })}`);
          rows.push(...d.items);
          if (p * 100 >= d.total) break;
        }
        downloadCsv(`admin-transactions-${range.from ?? "start"}-${range.to ?? "now"}.csv`, [
          ["Admin name", "Admin ID", "Username", "Transaction ID", "Type", "Account holder", "Account no.", "Amount", "Net paid", "Mode", "Date (IST)", "Time (IST)", "Status", "Office"],
          ...rows.map((t) => [t.admin.name, t.admin.id, t.admin.username, t.transactionId, txnLabel(t), t.account.holderName, t.account.accountNo,
            t.amount, t.type === "WITHDRAWAL" ? t.netAmount : "", t.mode, istDate(t.at), istTime(t.at), TXN_STATUS[t.status].label, t.office.name]),
        ]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const t = txns?.totals;
  const current = tab === "accounts" ? accounts : tab === "transactions" ? txns : null;
  const pages = current ? Math.max(1, Math.ceil(current.total / PAGE_SIZE)) : 1;
  const page = tab === "accounts" ? accPage : txPage;
  const setPage = tab === "accounts" ? setAccPage : setTxPage;

  return (
    <section className="space-y-4">
      {/* ---- when ---- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Period">
          {([["TODAY", "Today"], ["DAY", "A day"], ["MONTH", "A month"], ["RANGE", "Date range"], ["ALL", "Complete history"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={period.kind === k}
              onClick={() => setPeriod(k === "DAY" ? { kind: "DAY", day: istToday() } : k === "MONTH" ? { kind: "MONTH", month: istMonth() }
                : k === "RANGE" ? { kind: "RANGE", from: `${istMonth()}-01`, to: istToday() } : { kind: k })}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${period.kind === k ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
          {period.kind === "DAY" && (
            <input type="date" aria-label="Day" value={period.day} max={istToday()} onChange={(e) => e.target.value && setPeriod({ kind: "DAY", day: e.target.value })} className={dateCls} />
          )}
          {period.kind === "MONTH" && (
            <input type="month" aria-label="Month" value={period.month} max={istMonth()} onChange={(e) => e.target.value && setPeriod({ kind: "MONTH", month: e.target.value })} className={dateCls} />
          )}
          {period.kind === "RANGE" && (
            <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <input type="date" aria-label="From" value={period.from} max={period.to || istToday()} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className={dateCls} />
              to
              <input type="date" aria-label="To" value={period.to} min={period.from} max={istToday()} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className={dateCls} />
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing <b className="text-navy">{range.label}</b> · Indian Standard Time · amounts count successful transactions only
        </p>
      </div>

      {/* ---- totals (follow every filter) ---- */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon="barChart" label="Transactions" value={t ? String(t.transactions) : "—"} hint={t ? `${t.deposits.count} deposits · ${t.withdrawals.count} withdrawals` : undefined} />
        <Stat icon="download" tone="text-emerald-700" label="Deposits" value={t ? money(t.deposits.amount) : "—"} hint={t ? `${t.deposits.count} transactions` : undefined} />
        <Stat icon="upload" tone="text-red-700" label="Withdrawals" value={t ? money(t.withdrawals.amount) : "—"} hint={t ? `${t.withdrawals.count} transactions` : undefined} />
        <Stat icon="userPlus" tone="text-blue-700" label="Accounts opened" value={accounts ? String(accounts.total) : "—"} />
        <Stat icon="info" tone={t?.notSuccessful ? "text-amber-700" : "text-navy"} label="Not successful" value={t ? String(t.notSuccessful) : "—"}
          hint="failed / pending / reversed — not in the amounts" />
      </dl>

      {error && <Alert tone="error">{error}</Alert>}

      {/* ---- what ---- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 sm:px-4">
          <div className="-mx-1 flex overflow-x-auto" role="tablist" aria-label="History">
            {([["transactions", `Transactions${txns ? ` (${txns.total})` : ""}`, "fileText"], ["accounts", `Accounts opened${accounts ? ` (${accounts.total})` : ""}`, "userPlus"],
              ...(group ? [["breakdown", group === "DAY" ? "Day by day" : "Month by month", "calendar"] as const] : [])] as const).map(([id, label, icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${tab === id ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-navy"}`}>
                <Icon name={icon} className="size-4" /> {label}
              </button>
            ))}
          </div>
          {tab !== "breakdown" && (
            <button type="button" onClick={exportCsv} disabled={exporting || !current?.total}
              className="my-2 flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50">
              <Icon name="download" className="size-4" /> {exporting ? "Preparing…" : "Export CSV"}
            </button>
          )}
        </div>

        {tab !== "breakdown" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4">
            {!adminId && (
              <SearchBox value={adminSearch} onChange={setAdminSearch} placeholder="Admin name or ID" label="Search admin" icon="user" />
            )}
            <SearchBox value={search} onChange={setSearch} label="Search"
              placeholder={tab === "transactions" ? "Holder name, account no. or transaction ID" : "Holder name or account no."} />
            {tab === "transactions" && (
              <>
                <div className="flex gap-1" role="group" aria-label="Type">
                  {([["", "All"], ["DEPOSIT", "Deposits"], ["WITHDRAWAL", "Withdrawals"]] as const).map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}
                      className={`h-9 rounded-lg border px-3 text-xs font-medium ${type === v ? "border-brand bg-brand-soft text-brand" : "border-slate-200 bg-white text-slate-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as "" | TxnStatus)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-navy">
                  <option value="">Any status</option>
                  {(Object.keys(TXN_STATUS) as TxnStatus[]).map((s) => <option key={s} value={s}>{TXN_STATUS[s].label}</option>)}
                </select>
              </>
            )}
          </div>
        )}

        {tab === "transactions" && (!txns ? <div className="p-4"><TableSkeleton rows={6} columns={7} /></div> : txns.items.length === 0 ? (
          <Empty text="No transactions for these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:min-w-[960px]">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date · Time (IST)</th>
                  <th className="hidden md:table-cell px-3 py-2 font-medium">Transaction ID</th>
                  <th className="hidden md:table-cell px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Account holder</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="hidden md:table-cell px-3 py-2 font-medium">Status</th>
                  <th className="hidden md:table-cell px-4 py-2 font-medium">Done by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txns.items.map((r) => (
                  <tr key={r.transactionId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="block text-navy">{istDate(r.at)}</span>
                      <span className="block font-mono text-[11px] text-slate-500">{istTime(r.at)}</span>
                      <span className="block font-mono text-[11px] text-navy md:hidden">{r.transactionId}</span>
                    </td>
                    <td className="hidden md:table-cell px-3 py-2.5 font-mono text-xs text-navy">{r.transactionId}</td>
                    <td className="hidden md:table-cell px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "DEPOSIT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        <Icon name={r.type === "DEPOSIT" ? "download" : "upload"} className="size-3" /> {txnLabel(r)}
                      </span>
                      <span className="block text-[11px] text-slate-500">{r.mode.replace("_", " ").toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`${accountsBase}/${r.account.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{r.account.holderName}</Link>
                      <span className="block font-mono text-[11px] text-slate-500">{r.account.accountNo}</span>
                      <span className="block text-[11px] text-slate-500 md:hidden">by {r.admin.name} · ID {r.admin.id}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.type === "DEPOSIT" ? "text-emerald-700" : "text-red-700"}`}>
                      {r.type === "DEPOSIT" ? "+" : "−"}{money(r.amount)}
                      {r.type === "WITHDRAWAL" && r.netAmount !== r.amount && <span className="block text-[11px] font-normal text-slate-500">paid {money(r.netAmount)}</span>}
                      <span className="block text-[11px] font-normal text-slate-500 md:hidden">
                        {txnLabel(r)}{r.status !== "SUCCESS" ? ` · ${TXN_STATUS[r.status].label}` : ""}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TXN_STATUS[r.status].cls}`}>{TXN_STATUS[r.status].label}</span></td>
                    <td className="hidden md:table-cell px-4 py-2.5"><AdminCell admin={r.admin} recordedBy={r.recordedBy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === "accounts" && (!accounts ? <div className="p-4"><TableSkeleton rows={6} columns={6} /></div> : accounts.items.length === 0 ? (
          <Empty text="No accounts opened for these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:min-w-[820px]">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Created · Time (IST)</th>
                  <th className="px-3 py-2 font-medium">Account holder</th>
                  <th className="px-3 py-2 text-right font-medium">Opening amount</th>
                  <th className="hidden md:table-cell px-3 py-2 font-medium">KYC</th>
                  <th className="hidden md:table-cell px-3 py-2 font-medium">Office</th>
                  <th className="hidden md:table-cell px-4 py-2 font-medium">Opened by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.items.map((r) => (
                  <tr key={r.account.accountNo} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="block text-navy">{istDate(r.createdAt)}</span>
                      <span className="block font-mono text-[11px] text-slate-500">{istTime(r.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`${accountsBase}/${r.account.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{r.account.holderName}</Link>
                      <span className="block font-mono text-[11px] text-slate-500">
                        {r.account.accountNo}{r.account.status === "CLOSED" ? " · closed" : ""}
                      </span>
                      <span className="block text-[11px] text-slate-500 md:hidden">by {r.admin.name} · ID {r.admin.id}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-navy">{money(r.openingAmount)}</td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs">
                      <span className={r.account.kycStatus === "VERIFIED" ? "text-emerald-700" : "text-amber-700"}>
                        {r.account.kycStatus.charAt(0) + r.account.kycStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs text-slate-600">{r.office.name}</td>
                    <td className="hidden md:table-cell px-4 py-2.5"><AdminCell admin={r.admin} recordedBy={r.recordedBy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === "breakdown" && group && (!periods ? <div className="p-4"><TableSkeleton rows={6} columns={6} /></div> : periods.length === 0 ? (
          <Empty text="No activity in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:min-w-[720px]">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{group === "DAY" ? "Day" : "Month"}</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                  <th className="px-3 py-2 text-right font-medium">Deposits</th>
                  <th className="px-3 py-2 text-right font-medium">Withdrawals</th>
                  <th className="hidden md:table-cell px-3 py-2 text-right font-medium">Accounts opened</th>
                  <th className="hidden md:table-cell px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map((p) => (
                  <tr key={p.period} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => { setPeriod(group === "DAY" ? { kind: "DAY", day: p.period } : { kind: "MONTH", month: p.period }); setTab("transactions"); }}
                        className="text-left font-medium text-navy hover:text-brand hover:underline">
                        {group === "DAY" ? dayLabel(p.period) : monthName(p.period)}
                      </button>
                      <span className="block text-[11px] text-slate-500 md:hidden">{p.accountsCreated} accounts opened</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.transactions}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{money(p.deposits.amount)}<span className="block text-[11px] text-slate-500">{p.deposits.count} txns</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-700">{money(p.withdrawals.amount)}<span className="block text-[11px] text-slate-500">{p.withdrawals.count} txns</span></td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-right tabular-nums">{p.accountsCreated}</td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
                      <button type="button" onClick={() => { setPeriod(group === "DAY" ? { kind: "DAY", day: p.period } : { kind: "MONTH", month: p.period }); setTab("transactions"); }}
                        className="text-xs font-medium text-brand hover:underline">
                        Open {group === "DAY" ? "day" : "month"} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {current && current.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>Page {page} of {pages} · {current.total} records</span>
            <span className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((x) => x - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((x) => x + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const dateCls = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-navy outline-none focus:border-brand";

function Stat({ icon, label, value, hint, tone = "text-navy" }: { icon: IconName; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500"><Icon name={icon} className="size-4 text-brand" /> {label}</dt>
      <dd className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-slate-500">{hint}</dd>}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label, icon = "search" }: {
  value: string; onChange: (v: string) => void; placeholder: string; label: string; icon?: IconName;
}) {
  return (
    <label className="relative w-full sm:w-72">
      <span className="sr-only">{label}</span>
      <Icon name={icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
    </label>
  );
}

/** The admin who did it; the name at that time is shown when it has changed since. */
function AdminCell({ admin, recordedBy }: { admin: ActivityTransaction["admin"]; recordedBy: string }) {
  return (
    <Link href={`/super-admin/admin-activity/${admin.id}`} className="group block">
      <span className="block font-medium text-navy group-hover:text-brand group-hover:underline">{admin.name}</span>
      <span className="block font-mono text-[11px] text-slate-500">
        ID {admin.id} · {admin.username}{admin.status !== "ACTIVE" ? ` · ${admin.status.toLowerCase()}` : ""}
      </span>
      {recordedBy !== admin.name && <span className="block text-[10px] text-slate-400">recorded as “{recordedBy}”</span>}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{text}</p>;
}
