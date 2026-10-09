"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import type { StatementPage, StatementType } from "@/lib/accounts/types";
import { DEPOSIT_MODES as PAYMENT_MODES, modeLabel, money, type DepositMode } from "@/lib/deposits/types";

import { TransactionCsvExporter } from "@/lib/accounts/TransactionCsvExporter";

const PAGE_SIZE = 20;
const exporter = new TransactionCsvExporter();

/**
 * Shared role-aware account statement, newest first, like a passbook:
 * deposits (credit), withdrawals (debit) and the balance right after each
 * entry (GET /api/admin/accounts/:accountNo/transactions).
 */
export function AccountTransactions({ accountNo }: { accountNo: string }) {
  const { authFetch } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const completeExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const report = await authFetch<StatementPage>(`/api/admin/accounts/${encodeURIComponent(accountNo)}/transactions/export`);
      exporter.download(accountNo, report);
    } catch (err) { setExportError(errorMessage(err)); }
    finally { setExporting(false); }
  };
  const [type, setType] = useState<StatementType | "">("");
  const [mode, setMode] = useState<DepositMode | "">("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const key = `${accountNo}|${type}|${mode}|${page}|${version}`;
  const [result, setResult] = useState<{ key: string; data: StatementPage | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (type) params.set("type", type);
    if (mode) params.set("mode", mode);
    authFetch<StatementPage>(
      `/api/admin/accounts/${encodeURIComponent(accountNo)}/transactions?${params}`,
      { signal: controller.signal },
    ).then(
      (data) => setResult({ key, data, error: null }),
      (err) => {
        if ((err as Error).name !== "AbortError") setResult((r) => ({ key, data: r.data, error: errorMessage(err) }));
      },
    );
    return () => controller.abort();
  }, [authFetch, accountNo, type, mode, page, key]);

  const data = result.data;
  const loading = result.key !== key;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const from = data && data.total ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const to = data ? from + data.items.length - (data.items.length ? 1 : 0) : 0;
  const filtered = !!(type || mode);
  const resetPage = () => setPage(1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5 sm:px-6">
        <h2 className="mr-auto flex items-center gap-2 font-semibold text-navy">
          <Icon name="fileText" className="size-5 text-brand" /> Transactions
        </h2>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as StatementType | "");
            resetPage();
          }}
          aria-label="Filter by type"
          className="h-9 rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-brand sm:text-sm"
        >
          <option value="">All transactions</option>
          <option value="DEPOSIT">Deposits (credit)</option>
          <option value="WITHDRAWAL">Withdrawals (debit)</option>
        </select>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as DepositMode | "");
            resetPage();
          }}
          aria-label="Filter by payment mode"
          className="h-9 rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-brand sm:text-sm"
        >
          <option value="">All modes</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setVersion((v) => v + 1)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-navy hover:bg-slate-50"
        >
          <Icon name="refresh" className="size-4" /> Refresh
        </button>
        <button type="button" onClick={completeExport} disabled={exporting}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-brand px-3 text-sm text-brand disabled:opacity-50">
          <Icon name="download" className="size-4" /> {exporting ? "Exporting…" : "Export all transactions"}
        </button>
        <Link
          href={`/admin/deposits?accountNo=${accountNo}`}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <Icon name="download" className="size-4" /> Deposit
        </Link>
        <Link
          href={`/admin/withdrawals?accountNo=${accountNo}`}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Icon name="upload" className="size-4" /> Withdraw
        </Link>
      </div>

      {exportError && <div className="p-4"><Alert tone="error">{exportError}</Alert></div>}
      {/* Super Admin summary, provided by the same role-aware API. */}
      {data?.summary && <dl className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 lg:grid-cols-5">
        <Stat label="Current Balance" value={money(data.summary.balance)} strong />
        <Stat label="Total Deposited" value={money(data.summary.totalDeposited)} tone="text-emerald-700" />
        <Stat label="Total Withdrawn" value={money(data.summary.totalWithdrawn)} tone="text-red-600" />
        <Stat label="Entries" value={String(data.summary.entryCount)} />
        <Stat label="Last Transaction" value={data.summary.lastAt ? formatDateTime(data.summary.lastAt) : "—"} />
      </dl>}

      {result.error && !loading ? (
        <div className="p-5">
          <Alert tone="error">
            {result.error}{" "}
            <button type="button" onClick={() => setVersion((v) => v + 1)} className="font-medium underline">
              Retry
            </button>
          </Alert>
        </div>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className={`divide-y divide-slate-100 md:hidden ${loading && data ? "opacity-60" : ""}`}>
            {loading && !data && <Skeleton as="li" />}
            {data?.items.map((t) => (
              <li key={t.receiptNo} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{particulars(t.kind, t.remarks)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(t.at)} · {modeLabel(t.mode)}
                  </p>
                  <p className="break-words text-xs text-slate-500">By {t.createdBy}{t.operator ? ` · ${t.operator.username ?? "System"} · ${t.operator.role}` : ""}</p>
                  <p className="break-all font-mono text-[11px] text-slate-400">
                    {t.receiptNo}
                    {t.referenceNo && ` · ${t.referenceNo}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {t.type === "WITHDRAWAL" ? (
                    <p className="font-semibold text-red-600">−{money(t.debit)}</p>
                  ) : (
                    <p className="font-semibold text-emerald-700">+{money(t.credit)}</p>
                  )}
                  <p className="text-xs text-slate-500">Bal {money(t.balanceAfter)}</p>
                </div>
              </li>
            ))}
            {data && data.items.length === 0 && <Empty filtered={filtered} as="li" />}
          </ul>

          {/* Tablet / desktop: passbook table */}
          <div className={`hidden overflow-x-auto md:block ${loading && data ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                  <th className="px-4 py-3 font-medium">Receipt No.</th>
                  <th className="px-4 py-3 font-medium">Particulars</th>
                  <th className="px-4 py-3 font-medium">Mode / Reference</th>
                  <th className="px-4 py-3 font-medium">By</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !data && <Skeleton as="tr" />}
                {data?.items.map((t) => (
                  <tr key={t.receiptNo} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">{formatDateTime(t.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-navy">{t.receiptNo}</td>
                    <td className="px-4 py-3">
                      {t.kind === "OPENING" ? (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-brand/20">
                          Opening amount
                        </span>
                      ) : t.kind === "INTEREST" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          {t.remarks ?? "Interest"}
                        </span>
                      ) : (
                        <span className="text-slate-700">{particulars(t.kind, t.remarks)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {modeLabel(t.mode)}
                      {t.referenceNo && <span className="block font-mono text-[11px] text-slate-500">{t.referenceNo}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{t.createdBy}
                      {t.operator && <span className="block text-[11px] text-slate-500">{t.operator.username ?? "System"} · {t.operator.role}{t.operator.id ? ` · #${t.operator.id}` : ""}</span>}
                      {t.office && <span className="block text-[11px] text-slate-500">{t.office.city} – {t.office.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-red-600">
                      {t.type === "WITHDRAWAL" ? `−${money(t.debit)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-emerald-700">
                      {t.type === "DEPOSIT" ? `+${money(t.credit)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-navy">{money(t.balanceAfter)}</td>
                  </tr>
                ))}
                {data && data.items.length === 0 && <Empty filtered={filtered} as="tr" />}
              </tbody>
            </table>
          </div>

          {data && data.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:px-6">
              <span className="text-slate-500">
                Showing {from}–{to} of {data.total} {data.total === 1 ? "entry" : "entries"}
                {filtered && " (filtered)"}
              </span>
              {pages > 1 && (
                <div className="flex gap-2">
                  <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Newer
                  </PageButton>
                  <PageButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Older
                  </PageButton>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const particulars = (kind: string, remarks: string | null) =>
  kind === "OPENING" ? "Opening amount" : (remarks ?? (kind === "WITHDRAWAL" ? "Withdrawal" : "Deposit"));

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="bg-white px-5 py-3 sm:px-6">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 ${strong ? "text-lg font-bold text-navy" : `text-sm font-semibold ${tone ?? "text-navy"}`}`}>
        {value}
      </dd>
    </div>
  );
}

function Skeleton({ as }: { as: "li" | "tr" }) {
  return Array.from({ length: 4 }, (_, i) =>
    as === "li" ? (
      <li key={i} className="p-4">
        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </li>
    ) : (
      <tr key={i}>
        <td colSpan={8} className="px-4 py-4">
          <div className="h-5 animate-pulse rounded bg-slate-100" />
        </td>
      </tr>
    ),
  );
}

function Empty({ filtered, as }: { filtered: boolean; as: "li" | "tr" }) {
  const text = filtered ? "No transactions match these filters." : "No transactions yet.";
  return as === "li" ? (
    <li className="px-4 py-12 text-center text-sm text-slate-500">{text}</li>
  ) : (
    <tr>
      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  );
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
