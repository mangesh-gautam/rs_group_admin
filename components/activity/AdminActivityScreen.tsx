"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { money } from "@/lib/deposits/types";
import { dayLabel, istMonth, istToday, monthName, useDebounced, type AdminActivityPage, type AdminActivityRow } from "@/lib/activity/types";
import { AdminHistory } from "./AdminHistory";

const PAGE_SIZE = 50;

/**
 * Super Admin → Admin Activity: every admin with the transactions and accounts they made
 * on a day and in a month (today / this month by default) and in all; open one admin for
 * the complete history. "All transactions" searches every admin's work at once.
 */
export function AdminActivityScreen({ basePath = "/super-admin/admin-activity" }: { basePath?: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"admins" | "all">("admins");
  const [day, setDay] = useState(istToday);
  const [month, setMonth] = useState(istMonth);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminActivityPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "admins") return undefined;
    const c = new AbortController();
    const p = new URLSearchParams({ day, month, page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) p.set("q", q);
    authFetch<AdminActivityPage>(`/api/admin/activity/admins?${p}`, { signal: c.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => c.abort();
  }, [authFetch, view, day, month, q, page]);

  const open = (id: number) => router.push(`${basePath}/${id}`);
  const isToday = day === istToday();
  const isThisMonth = month === istMonth();
  const dayName = isToday ? "Today" : dayLabel(day);
  const monthTitle = isThisMonth ? "This month" : monthName(month);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <Icon name="barChart" className="size-6 text-brand" /> Admin Activity
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Every deposit, withdrawal and new account, with the admin who made it — by day, by month or the complete history.
          Times are Indian Standard Time; amounts count successful transactions only.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit" role="tablist" aria-label="View">
        {([["admins", "Admins", "users"], ["all", "All transactions", "fileText"]] as const).map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium sm:flex-none ${view === id ? "bg-white text-navy shadow-sm" : "text-slate-600 hover:text-navy"}`}>
            <Icon name={icon} className="size-4" /> {label}
          </button>
        ))}
      </div>

      {view === "all" ? <AdminHistory /> : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium">Day</span>
              <input type="date" value={day} max={istToday()} onChange={(e) => { if (e.target.value) { setDay(e.target.value); setPage(1); } }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-brand" />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium">Month</span>
              <input type="month" value={month} max={istMonth()} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setPage(1); } }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-brand" />
            </label>
            {(!isToday || !isThisMonth) && (
              <button type="button" onClick={() => { setDay(istToday()); setMonth(istMonth()); setPage(1); }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50">
                Back to today
              </button>
            )}
            <label className="relative w-full sm:ml-auto sm:w-72">
              <span className="sr-only">Search admins</span>
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Admin name, username or ID"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </label>
          </div>

          {/* every admin together, for the chosen day and month */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Summary title={dayName} totals={data?.totals.day} />
            <Summary title={monthTitle} totals={data?.totals.month} />
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!data ? <div className="p-4"><TableSkeleton rows={5} columns={8} /></div> : data.items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No admin matches “{q}”.</p>
            ) : (
              <>
                {/* phones: one card per admin */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {data.items.map((r) => (
                    <li key={r.admin.id}>
                      <button type="button" onClick={() => open(r.admin.id)} className="block w-full space-y-2 px-4 py-3 text-left hover:bg-slate-50">
                        <AdminName row={r} />
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <MiniBlock title={dayName} b={r.day} />
                          <MiniBlock title={monthTitle} b={r.month} />
                        </div>
                        <p className="text-xs text-slate-500">All time: {r.allTime.transactions} transactions · {r.allTime.accountsCreated} accounts opened</p>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th rowSpan={2} className="px-4 py-2 text-left font-medium">Admin</th>
                        <th colSpan={3} className="border-l border-slate-200 px-3 pt-2 text-center font-semibold text-navy">{dayName}</th>
                        <th colSpan={3} className="border-l border-slate-200 px-3 pt-2 text-center font-semibold text-navy">{monthTitle}</th>
                        <th rowSpan={2} className="border-l border-slate-200 px-3 py-2 text-right font-medium">Accounts opened</th>
                        <th rowSpan={2} className="px-4 py-2" />
                      </tr>
                      <tr>
                        {[0, 1].map((i) => (
                          <th key={i} colSpan={3} className="border-l border-slate-200 p-0">
                            <span className="grid grid-cols-3 text-right font-medium">
                              <span className="px-3 py-1.5">Txns</span><span className="px-3 py-1.5">Deposits</span><span className="px-3 py-1.5">Withdrawals</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items.map((r) => (
                        <tr key={r.admin.id} onClick={() => open(r.admin.id)} className="cursor-pointer hover:bg-brand-soft/40">
                          <td className="px-4 py-2.5"><AdminName row={r} /></td>
                          <BlockCells b={r.day} />
                          <BlockCells b={r.month} />
                          <td className="border-l border-slate-100 px-3 py-2.5 text-right tabular-nums">
                            <span className="font-semibold text-navy">{r.allTime.accountsCreated}</span>
                            <span className="block text-[11px] text-slate-500">{r.month.accountsCreated} in month · {r.day.accountsCreated} on day</span>
                          </td>
                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <Link href={`${basePath}/${r.admin.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand/40 px-3 text-xs font-medium text-brand hover:bg-brand-soft">
                              View history <Icon name="chevronRight" className="size-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                <span>Page {page} of {pages}</span>
                <span className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ title, totals }: { title: string; totals?: AdminActivityPage["totals"]["day"] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-navy">{title} <span className="font-normal text-slate-500">· all admins</span></h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fig label="Transactions" value={totals ? String(totals.transactions) : "—"} />
        <Fig label="Deposits" value={totals ? money(totals.depositAmount) : "—"} tone="text-emerald-700" />
        <Fig label="Withdrawals" value={totals ? money(totals.withdrawalAmount) : "—"} tone="text-red-700" />
        <Fig label="Accounts opened" value={totals ? String(totals.accountsCreated) : "—"} />
      </dl>
    </section>
  );
}

function Fig({ label, value, tone = "text-navy" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

function AdminName({ row }: { row: AdminActivityRow }) {
  const a = row.admin;
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-navy">{a.name}</span>
        {a.role === "SUPER_ADMIN" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Super Admin</span>}
        {a.status !== "ACTIVE" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{a.status.toLowerCase()}</span>}
      </span>
      <span className="block font-mono text-[11px] text-slate-500">ID {a.id} · {a.username}{a.employeeId ? ` · ${a.employeeId}` : ""}</span>
      <span className="block text-[11px] text-slate-500">
        {a.office ? a.office.name : "All offices"}
        {row.allTime.lastTransactionAt ? ` · last transaction ${formatDateTime(row.allTime.lastTransactionAt)}` : " · no transactions yet"}
      </span>
    </span>
  );
}

function BlockCells({ b }: { b: AdminActivityRow["day"] }) {
  return (
    <>
      <td className="border-l border-slate-100 px-3 py-2.5 text-right font-semibold text-navy tabular-nums">{b.transactions || <span className="font-normal text-slate-300">0</span>}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
        {money(b.deposits.amount)}<span className="block text-[11px] text-slate-500">{b.deposits.count} txns</span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-red-700">
        {money(b.withdrawals.amount)}<span className="block text-[11px] text-slate-500">{b.withdrawals.count} txns</span>
      </td>
    </>
  );
}

function MiniBlock({ title, b }: { title: string; b: AdminActivityRow["day"] }) {
  return (
    <span className="block rounded-lg bg-slate-50 p-2">
      <span className="block font-medium text-navy">{title}: {b.transactions} txns</span>
      <span className="block text-emerald-700">+{money(b.deposits.amount)}</span>
      <span className="block text-red-700">−{money(b.withdrawals.amount)}</span>
      <span className="block text-slate-500">{b.accountsCreated} accounts</span>
    </span>
  );
}
