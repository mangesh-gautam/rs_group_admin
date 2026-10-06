"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate } from "@/lib/accounts/types";
import { formatDateTime } from "@/lib/auth/types";
import {
  DEPOSIT_MODES,
  accountTypeLabel,
  modeLabel,
  money,
  type DepositAccount,
  type DepositMode,
  type DepositPage,
  type DepositReceipt,
} from "@/lib/deposits/types";

/** "rs 110033 000001" / "110033000001" → "RS110033000001" */
const normaliseAccountNo = (v: string) => {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{12}$/.test(s) ? `RS${s}` : s;
};

/**
 * Deposits screen: the deposit desk (find account → amount → receipt) and the
 * deposit history. Recording a deposit refreshes the history.
 */
export function DepositsScreen({ initialAccountNo }: { initialAccountNo: string }) {
  const [historyVersion, setHistoryVersion] = useState(0);
  const [focusAccount, setFocusAccount] = useState<string | null>(null);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <DepositDesk
        initialAccountNo={initialAccountNo}
        onAccount={setFocusAccount}
        onDeposited={() => setHistoryVersion((v) => v + 1)}
      />
      <DepositHistory version={historyVersion} accountNo={focusAccount} />
    </div>
  );
}

/* ================================ Desk ================================ */

type Values = { amount: string; mode: DepositMode | ""; referenceNo: string; remarks: string };
type Errors = Partial<Record<keyof Values | "accountNo", string>>;
const EMPTY: Values = { amount: "", mode: "CASH", referenceNo: "", remarks: "" };

function DepositDesk({
  initialAccountNo,
  onAccount,
  onDeposited,
}: {
  initialAccountNo: string;
  onAccount: (accountNo: string | null) => void;
  onDeposited: () => void;
}) {
  const { authFetch } = useAuth();
  const [accountInput, setAccountInput] = useState(initialAccountNo);
  const [account, setAccount] = useState<DepositAccount | null>(null);
  const [finding, setFinding] = useState(false);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<DepositReceipt | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const find = useCallback(
    async (raw: string) => {
      const accountNo = normaliseAccountNo(raw);
      setErrors({});
      setFormError(null);
      setReceipt(null);
      if (!/^RS\d{12}$/.test(accountNo)) {
        setAccount(null);
        onAccount(null);
        setErrors({ accountNo: "Enter the 14-character account number, e.g. RS110033000001" });
        return;
      }
      setFinding(true);
      try {
        const found = await authFetch<DepositAccount>(`/api/deposits/accounts/${accountNo}`);
        setAccount(found);
        setAccountInput(found.accountNo);
        onAccount(found.accountNo);
        setValues(EMPTY);
        setTimeout(() => amountRef.current?.focus(), 0);
      } catch (err) {
        setAccount(null);
        onAccount(null);
        setErrors({
          accountNo:
            err instanceof ApiError && err.status === 404
              ? "No account with this number in your office"
              : errorMessage(err),
        });
      } finally {
        setFinding(false);
      }
    },
    [authFetch, onAccount],
  );

  // Pre-filled from ?accountNo=… → look it up once.
  const didInitial = useRef(false);
  useEffect(() => {
    if (initialAccountNo && !didInitial.current) {
      didInitial.current = true;
      void find(initialAccountNo);
    }
  }, [initialAccountNo, find]);

  const set = (field: keyof Values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const modeInfo = DEPOSIT_MODES.find((m) => m.value === values.mode);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const found: Errors = {};
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.amount) || Number(values.amount) <= 0) {
      found.amount = "Enter an amount greater than 0";
    }
    if (!values.mode) found.mode = "Select the payment mode";
    if (modeInfo?.reference && !values.referenceNo.trim()) found.referenceNo = `Enter the ${modeInfo.reference}`;
    setErrors(found);
    if (Object.keys(found).length) return;

    if (!window.confirm(`Deposit ${money(values.amount)} (${modeLabel(values.mode as DepositMode)}) into ${account.accountNo} — ${account.name}?`)) {
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await authFetch<DepositReceipt>("/api/deposits", {
        method: "POST",
        body: { accountNo: account.accountNo, ...values },
      });
      setReceipt(result);
      setAccount((a) =>
        a && {
          ...a,
          balance: result.balance,
          depositCount: a.depositCount + 1,
          totalDeposited: (Number(a.totalDeposited) + Number(result.amount)).toFixed(2),
          lastDepositAt: result.depositedAt,
        },
      );
      setValues(EMPTY);
      onDeposited();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details as Errors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-navy">
        <Icon name="plusCircle" className="size-6 text-brand" /> Deposit Amount
      </h2>

      {/* Step 1 — account */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void find(accountInput);
        }}
        noValidate
      >
        <Label required>Account No.</Label>
        <div className="flex gap-2">
          <input
            className={`${inputCls(errors.accountNo)} font-mono uppercase`}
            placeholder="RS110033000001"
            value={accountInput}
            onChange={(e) => {
              setAccountInput(e.target.value);
              setErrors((x) => ({ ...x, accountNo: undefined }));
            }}
            autoFocus={!initialAccountNo}
          />
          <button
            type="submit"
            disabled={finding}
            className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-brand/50 px-5 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            {finding ? <Spinner /> : <Icon name="search" className="size-4" />}
            Find
          </button>
        </div>
        {errors.accountNo && <p className="mt-1 text-xs text-red-500">{errors.accountNo}</p>}
      </form>

      {account && (
        <div className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
          <img
            src={account.photo}
            alt={`Photograph of ${account.name}`}
            className="aspect-[35/45] w-16 shrink-0 rounded border border-slate-200 bg-white object-cover"
          />
          <div className="min-w-0 flex-1 text-sm">
            <Link href={`/admin/accounts/${account.accountNo}`} className="font-semibold text-navy hover:underline">
              {account.name}
            </Link>
            {account.fatherHusbandName && <p className="text-xs text-slate-500">C/o {account.fatherHusbandName}</p>}
            <p className="mt-1 text-xs text-slate-600">
              <span className="font-mono">{account.accountNo}</span> · +91 {account.mobileNumber} · {account.office.city} –{" "}
              {account.office.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="text-xs text-slate-500">Balance </span>
                <b className="text-lg text-emerald-700">{money(account.balance)}</b>
              </span>
              <span className="self-end text-xs text-slate-500">
                {account.depositCount} deposit{account.depositCount === 1 ? "" : "s"}
                {account.lastDepositAt && ` · last ${formatDateTime(account.lastDepositAt)}`}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {accountTypeLabel(account.terms.accountType)} account · interest {account.terms.interestRate}% p.m. · buffer{" "}
              {account.terms.bufferDays} days
              {account.nextDueOn && ` · next due ${formatDate(account.nextDueOn)}`}
            </p>
            {account.finesApplicable > 0 && (
              <p className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                Fine applicable: {account.finesApplicable} installment{account.finesApplicable === 1 ? "" : "s"} not paid within the buffer
              </p>
            )}
          </div>
        </div>
      )}

      {receipt && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="checkCircle" className="size-5" /> Deposit recorded
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <ReceiptItem label="Receipt No." value={receipt.receiptNo} mono />
            <ReceiptItem label="Amount" value={money(receipt.amount)} />
            <ReceiptItem label="New Balance" value={money(receipt.balance)} />
            <ReceiptItem label="Mode" value={modeLabel(receipt.mode)} />
            <ReceiptItem label="Reference" value={receipt.referenceNo ?? "—"} mono />
            <ReceiptItem label="Date" value={formatDateTime(receipt.depositedAt)} />
            <ReceiptItem label="Received By" value={receipt.createdBy} />
          </dl>
        </div>
      )}

      {/* Step 2 — amount */}
      {account && (
        <form onSubmit={submit} noValidate className="space-y-4 border-t border-slate-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>Amount (₹)</Label>
              <input
                ref={amountRef}
                className={`${inputCls(errors.amount)} text-base font-semibold`}
                inputMode="decimal"
                placeholder="e.g. 1000"
                value={values.amount}
                onChange={(e) => set("amount")(e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"))}
              />
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
            </div>
            <div>
              <Label required>Payment Mode</Label>
              <select
                className={inputCls(errors.mode)}
                value={values.mode}
                onChange={(e) => {
                  set("mode")(e.target.value);
                  set("referenceNo")("");
                }}
              >
                {DEPOSIT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.mode && <p className="mt-1 text-xs text-red-500">{errors.mode}</p>}
            </div>
            {modeInfo?.reference && (
              <div className="sm:col-span-2">
                <Label required>{modeInfo.reference}</Label>
                <input
                  className={`${inputCls(errors.referenceNo)} font-mono`}
                  placeholder={modeInfo.reference}
                  maxLength={40}
                  value={values.referenceNo}
                  onChange={(e) => set("referenceNo")(e.target.value.replace(/[^A-Za-z0-9/-]/g, ""))}
                />
                {errors.referenceNo && <p className="mt-1 text-xs text-red-500">{errors.referenceNo}</p>}
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Remarks</Label>
              <input
                className={inputCls(errors.remarks)}
                placeholder="Optional, e.g. Monthly deposit – October"
                maxLength={200}
                value={values.remarks}
                onChange={(e) => set("remarks")(e.target.value)}
              />
              {errors.remarks && <p className="mt-1 text-xs text-red-500">{errors.remarks}</p>}
            </div>
          </div>

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Deposits can&apos;t be edited or deleted once recorded.</p>
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-lg bg-brand px-7 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-70"
            >
              {saving ? <Spinner /> : <Icon name="download" className="size-4" />}
              {saving ? "Saving…" : values.amount && Number(values.amount) > 0 ? `Deposit ${money(values.amount)}` : "Deposit"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* =============================== History =============================== */

const PAGE_SIZE = 15;

function DepositHistory({ version, accountNo }: { version: number; accountNo: string | null }) {
  const { authFetch } = useAuth();
  const [onlyAccount, setOnlyAccount] = useState(true);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const filterAccount = onlyAccount ? accountNo : null;
  const key = `${filterAccount}|${q}|${page}|${version}`;
  const [result, setResult] = useState<{ key: string; data: DepositPage | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (filterAccount) params.set("accountNo", filterAccount);
    if (q) params.set("q", q);
    authFetch<DepositPage>(`/api/deposits?${params}`, { signal: controller.signal }).then(
      (data) => setResult({ key, data, error: null }),
      (err) => {
        if ((err as Error).name !== "AbortError") setResult((r) => ({ key, data: r.data, error: errorMessage(err) }));
      },
    );
    return () => controller.abort();
  }, [authFetch, filterAccount, q, page, key]);

  const data = result.data;
  const loading = result.key !== key;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold text-navy">
          <Icon name="fileText" className="size-5 text-brand" />
          {filterAccount ? `Deposits — ${filterAccount}` : "Recent Deposits"}
        </h2>
        {accountNo && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={onlyAccount}
              onChange={(e) => {
                setOnlyAccount(e.target.checked);
                setPage(1);
              }}
              className="accent-brand"
            />
            This account only
          </label>
        )}
        <label className="relative w-full sm:w-56">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt, account or name…"
            className="h-9 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm"
          />
        </label>
      </div>

      {result.error && !loading ? (
        <div className="p-4">
          <Alert tone="error">{result.error}</Alert>
        </div>
      ) : (
        <div className={`overflow-x-auto ${loading && data ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt / Date</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((d) => (
                <tr key={d.receiptNo}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-medium text-navy">{d.receiptNo}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(d.depositedAt)} · {d.createdBy}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/accounts/${d.accountNo}`} className="font-medium text-navy hover:underline">
                      {d.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">{d.accountNo}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {d.kind === "OPENING" ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-brand/20">
                        Opening
                      </span>
                    ) : d.kind === "INTEREST" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Interest
                      </span>
                    ) : (
                      modeLabel(d.mode)
                    )}
                    {d.referenceNo && <p className="font-mono text-[11px] text-slate-500">{d.referenceNo}</p>}
                    {d.remarks && <p className="text-[11px] text-slate-500">{d.remarks}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">+{money(d.amount)}</td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                    {q || filterAccount ? "No deposits match." : "No deposits yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <span className="text-slate-500">
            Page {data.page} of {pages} · {data.total} deposits
          </span>
          <div className="flex gap-2">
            <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </PageButton>
            <PageButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </PageButton>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ helpers ------------------------------ */

const inputCls = (error?: string) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-base text-slate-800 sm:text-sm outline-none placeholder:text-slate-400 focus:ring-2 ${
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-slate-200 focus:border-brand focus:ring-brand/15"
  }`;

function Label({ required, children }: { required?: boolean; children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-navy">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

function ReceiptItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-emerald-700/80">{label}</dt>
      <dd className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
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
