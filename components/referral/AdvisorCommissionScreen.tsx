"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { money } from "@/lib/deposits/types";
import {
  COMMISSION_STATUS,
  PAYOUT_LABEL,
  currentMonth,
  monthLabel,
  rateLabel,
  type CommissionConfig,
  type CommissionMonthRow,
  type CommissionOverview,
  type CommissionPayout,
  type CommissionStatus,
  type PayoutType,
} from "@/lib/referral/types";
import { PayButtons, PayoutDialog, PayoutHistory } from "./AdvisorCommissionDetail";

const PAGE_SIZE = 25;

/**
 * Advisor Commission: each advisor's commission balance month by month —
 * opening, earned, paid, closing — kept apart from their savings account.
 * Admins pay commission (or the advisor withdraws it) in cash, never more
 * than the balance; every payout gets a CMP… receipt and stays in the history.
 */
export function AdvisorCommissionScreen({ initialMonth, basePath }: { initialMonth: string | null; basePath: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [month, setMonth] = useState(() => initialMonth ?? currentMonth());
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [status, setStatus] = useState<Exclude<CommissionStatus, "NONE"> | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CommissionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payout, setPayout] = useState<{ row: Pick<CommissionMonthRow, "advisor" | "available">; type: PayoutType } | null>(null);
  const [receipt, setReceipt] = useState<CommissionPayout | null>(null);
  const [version, setVersion] = useState(0); // bumped after a payout → everything reloads

  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ month, page: String(page), pageSize: String(PAGE_SIZE), active: String(onlyActive) });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    authFetch<CommissionOverview>(`/api/deposits/advisor-commissions?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, month, q, onlyActive, status, page, version]);

  /** The month's report as CSV (every advisor shown by the current filters). */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: CommissionMonthRow[] = [];
      for (let p = 1; ; p++) {
        const params = new URLSearchParams({ month, page: String(p), pageSize: "100", active: String(onlyActive) });
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        const d = await authFetch<CommissionOverview>(`/api/deposits/advisor-commissions?${params}`);
        rows.push(...d.items);
        if (p * 100 >= d.total) break;
      }
      const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      const lines = [
        ["Advisor", "Account no.", "Office", "Carried forward", "Earned", "Reversed", "Adjusted", "Paid", "Outstanding", "Status", "Payable now"],
        ...rows.map((r) => [r.advisor.name, r.advisor.accountNo, r.advisor.office.name, r.opening, r.earned, r.reversed, r.adjusted,
          r.paid, r.closing, COMMISSION_STATUS[r.status].label, r.available]),
      ].map((l) => l.map(cell).join(","));
      const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `advisor-commission-${month}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  /** The advisor's own page; the month travels along so "back" returns to it. */
  const open = (accountNo: string) => router.push(`${basePath}/${accountNo}?month=${month}`);

  const paid = (r: CommissionPayout) => {
    setPayout(null);
    setReceipt(r);
    setVersion((v) => v + 1);
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const t = data?.totals;
  const isCurrent = month === currentMonth();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <Icon name="wallet" className="size-6 text-brand" /> Advisor Commission
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Commission each advisor earned from their referrals, month by month. It is kept apart from their savings —
          pay it out in cash, never more than the balance.
        </p>
      </div>

      <CommissionFlow />

      {receipt && (
        <Alert tone="success">
          <span className="font-medium">{PAYOUT_LABEL[receipt.type]} of {money(receipt.amount)}</span> to {receipt.advisor.name} — receipt{" "}
          <span className="font-mono">{receipt.receiptNo}</span>. Commission balance now {money(receipt.balanceAfter ?? "0")}.
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-medium">Month</span>
          <input type="month" value={month} max={currentMonth()} required
            onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setPage(1); } }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-brand" />
        </label>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search advisors</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Advisor name or account no."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={!onlyActive} onChange={(e) => { setOnlyActive(!e.target.checked); setPage(1); }}
            className="size-4 accent-[var(--color-brand)]" />
          Include settled advisors
        </label>
        <button type="button" onClick={exportCsv} disabled={exporting || !data?.total}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">
          <Icon name="download" className="size-4" /> {exporting ? "Preparing…" : `Export ${monthLabel(month)} (CSV)`}
        </button>
      </div>

      {t && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Carried forward (unpaid)" value={money(t.opening)} hint={`from before ${monthLabel(data.month)}`} />
          <Stat label={`Earned in ${monthLabel(data.month)}`} value={money(t.earned)} tone="green"
            hint={Number(t.reversed) || Number(t.adjusted) ? `reversed ${money(t.reversed)} · adjusted ${money(t.adjusted)}` : undefined} />
          <Stat label={`Paid in ${monthLabel(data.month)}`} value={money(t.paid)} tone="red" />
          <Stat label="Outstanding at month end" value={money(t.closing)} hint={isCurrent ? "so far" : undefined} />
          <Stat label="Payable now (all months)" value={money(t.available)} tone="brand" />
        </dl>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by payment status">
          <StatusChip active={status === null} onClick={() => { setStatus(null); setPage(1); }} label="All advisors" />
          <StatusChip active={status === "PENDING"} onClick={() => { setStatus("PENDING"); setPage(1); }} label="Pending" count={data.counts.pending} tone="PENDING" />
          <StatusChip active={status === "PARTIAL"} onClick={() => { setStatus("PARTIAL"); setPage(1); }} label="Partially paid" count={data.counts.partial} tone="PARTIAL" />
          <StatusChip active={status === "PAID"} onClick={() => { setStatus("PAID"); setPage(1); }} label="Fully paid" count={data.counts.paid} tone="PAID" />
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* ---- advisors in the month ---- */}
      <section className="@container/list overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {!data && !error && <div className="m-4 h-64 animate-pulse rounded-xl bg-slate-100" />}
        {data && data.items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {q || status ? "No advisor matches these filters." : `No commission activity in ${monthLabel(data.month)}, and nothing is due.`}
          </p>
        )}
        {data && data.items.length > 0 && (
          <>
            {/* narrow: cards */}
            <ul className="divide-y divide-slate-100 @3xl/list:hidden">
              {data.items.map((r) => (
                <li key={r.advisor.accountNo} className="space-y-2 px-4 py-3 hover:bg-slate-50">
                  <button type="button" onClick={() => open(r.advisor.accountNo)} className="block w-full text-left">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium text-navy">{r.advisor.name} {!r.commissionActive && <StoppedBadge />}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-500">{r.advisor.accountNo}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-bold text-navy tabular-nums">{money(r.available)}</span>
                        <span className="block text-[10px] text-slate-500 uppercase">payable</span>
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                    <span className="mt-1.5 grid grid-cols-4 gap-1 text-[11px] text-slate-500">
                      <Cell label="Opening" value={r.opening} />
                      <Cell label="Earned" value={r.earned} tone="green" />
                      <Cell label="Paid" value={r.paid} tone="red" />
                      <Cell label="Closing" value={r.closing} />
                    </span>
                  </button>
                  <PayButtons row={r} onPay={(type) => setPayout({ row: r, type })} />
                </li>
              ))}
            </ul>
            {/* wide: table */}
            <div className="hidden overflow-x-auto @3xl/list:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Advisor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Carried forward</th>
                    <th className="px-3 py-2.5 text-right font-medium">Earned</th>
                    <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                    <th className="px-3 py-2.5 text-right font-medium">Outstanding</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Payable now</th>
                    <th className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((r) => (
                    <tr key={r.advisor.accountNo} onClick={() => open(r.advisor.accountNo)} className="cursor-pointer hover:bg-brand-soft/50">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => open(r.advisor.accountNo)} className="text-left">
                          <span className="block font-medium text-navy hover:text-brand hover:underline">{r.advisor.name} {!r.commissionActive && <StoppedBadge />}</span>
                          <span className="block font-mono text-[11px] text-slate-500">{r.advisor.accountNo} · {r.advisor.office.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{money(r.opening)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700 tabular-nums">
                        {money(r.earned)}
                        {r.earnedCount > 0 && <span className="block text-[10px] text-slate-400">from {r.earnedCount} deposits</span>}
                        {Number(r.reversed) !== 0 && <span className="block text-[10px] text-red-600">reversed {money(r.reversed)}</span>}
                        {Number(r.adjusted) !== 0 && <span className="block text-[10px] text-blue-700">adjusted {money(r.adjusted)}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-red-700 tabular-nums">{money(r.paid)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-navy tabular-nums">{money(r.closing)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5 text-right font-bold text-navy tabular-nums">{money(r.available)}</td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><PayButtons row={r} onPay={(type) => setPayout({ row: r, type })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>Page {page} of {pages}</span>
            <span className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
            </span>
          </div>
        )}
      </section>

      {/* ---- one advisor: statement + history ---- */}
      <PayoutHistory key={`${month}-${version}`} month={month} />

      {payout && (
        <PayoutDialog advisor={payout.row.advisor} available={payout.row.available} initialType={payout.type}
          onDone={paid} onCancel={() => setPayout(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "green" | "red" | "brand" }) {
  const color = { green: "text-emerald-700", red: "text-red-700", brand: "text-brand" }[tone ?? "green"];
  return (
    <div className={`min-w-0 rounded-xl border bg-white p-3 ${tone === "brand" ? "border-brand/40" : "border-slate-200"}`}>
      <dt className="truncate text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 truncate text-lg font-bold tabular-nums ${tone ? color : "text-navy"}`}>{value}</dd>
      {hint && <dd className="text-[10px] text-slate-400">{hint}</dd>}
    </div>
  );
}

function StatusBadge({ status }: { status: CommissionStatus }) {
  const s = COMMISSION_STATUS[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ${s.className}`}>{s.label}</span>;
}

function StatusChip({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count?: number; tone?: CommissionStatus }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium ${active ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {tone && <span className={`size-2 rounded-full ${{ PENDING: "bg-amber-500", PARTIAL: "bg-blue-500", PAID: "bg-emerald-500", NONE: "bg-slate-400" }[tone]}`} />}
      {label}
      {count !== undefined && <span className={`rounded-full px-1.5 tabular-nums ${active ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>}
    </button>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <span className="min-w-0">
      <span className="block">{label}</span>
      <span className={`block truncate font-medium tabular-nums ${tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-navy"}`}>{money(value)}</span>
    </span>
  );
}

/* ---- how commission flows ----------------------------------------------------------- */

/** Member deposits → advisors above earn (rates as configured) → balance → paid in cash. */
function CommissionFlow() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<CommissionConfig>("/api/deposits/commission-config", { signal: controller.signal }).then(setConfig, () => {});
    return () => controller.abort();
  }, [authFetch]);

  const levels = config?.levels.filter((l) => l.active) ?? [];
  const steps = [
    { icon: "download" as const, title: "Member deposits", text: "A member deposits into their savings account (opening deposit excluded)." },
    {
      icon: "users" as const,
      title: "Advisors earn commission",
      text: levels.length
        ? levels.map((l) => `${l.level === 1 ? "Direct sponsor" : `L${l.level}`} ${rateLabel(l.type, l.value)}`).join(" · ")
        : "Up to 5 sponsors above the member, each at their level's rate.",
    },
    { icon: "calendar" as const, title: "Unpaid carries forward", text: "Carried forward + earned − paid = outstanding, every month, automatically. Never mixed with savings, never earns interest." },
    { icon: "wallet" as const, title: "Paid out in cash", text: "Pay in full or in part, up to the balance. Each payout gets a CMP receipt; a double-click never pays twice." },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-navy">
        <span className="flex items-center gap-2"><Icon name="info" className="size-4 text-brand" /> How advisor commission works</span>
        <Icon name="chevronDown" className={`size-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="grid grid-cols-1 gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((st, i) => (
            <li key={st.title} className="relative flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon name={st.icon} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-navy">{i + 1}. {st.title}</span>
                <span className="block text-[11px] leading-snug text-slate-600">{st.text}</span>
              </span>
              {i < steps.length - 1 && (
                <Icon name="arrowRight" className="absolute top-1/2 -right-2.5 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-white text-slate-400 lg:block" />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The Super Admin stopped this advisor's new commission. */
function StoppedBadge() {
  return (
    <span title="Commission stopped by the Super Admin — new deposits earn this advisor nothing"
      className="ml-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
      Commission stopped
    </span>
  );
}
