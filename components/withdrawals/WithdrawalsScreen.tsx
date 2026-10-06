"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { DEPOSIT_MODES as PAYMENT_MODES, modeLabel, money } from "@/lib/deposits/types";
import type {
  PaymentMode,
  WithdrawalAccount,
  WithdrawalPage,
  WithdrawalReceipt,
} from "@/lib/withdrawals/types";

/** "rs 110033 000001" / "110033000001" → "RS110033000001" */
const normaliseAccountNo = (v: string) => {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{12}$/.test(s) ? `RS${s}` : s;
};

/**
 * Withdrawals screen: the withdrawal desk (find account → amount ≤ available
 * balance → receipt) and the withdrawal history. Paying out refreshes the history.
 */
export function WithdrawalsScreen({ initialAccountNo }: { initialAccountNo: string }) {
  const [historyVersion, setHistoryVersion] = useState(0);
  const [focusAccount, setFocusAccount] = useState<string | null>(null);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <WithdrawalDesk
        initialAccountNo={initialAccountNo}
        onAccount={setFocusAccount}
        onWithdrawn={() => setHistoryVersion((v) => v + 1)}
      />
      <WithdrawalHistory version={historyVersion} accountNo={focusAccount} />
    </div>
  );
}

/* ================================ Desk ================================ */

type Values = { amount: string; mode: PaymentMode; referenceNo: string; remarks: string };
type Errors = Partial<Record<keyof Values | "accountNo", string>>;
const EMPTY: Values = { amount: "", mode: "CASH", referenceNo: "", remarks: "" };

function WithdrawalDesk({
  initialAccountNo,
  onAccount,
  onWithdrawn,
}: {
  initialAccountNo: string;
  onAccount: (accountNo: string | null) => void;
  onWithdrawn: () => void;
}) {
  const { authFetch } = useAuth();
  const [accountInput, setAccountInput] = useState(initialAccountNo);
  const [account, setAccount] = useState<WithdrawalAccount | null>(null);
  const [finding, setFinding] = useState(false);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null);
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
        const found = await authFetch<WithdrawalAccount>(`/api/withdrawals/accounts/${accountNo}`);
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

  const modeInfo = PAYMENT_MODES.find((m) => m.value === values.mode);
  const available = account ? Number(account.balance) : 0;
  const amountNum = Number(values.amount);
  const remaining = values.amount && amountNum > 0 ? (available - amountNum).toFixed(2) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const found: Errors = {};
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.amount) || amountNum <= 0) {
      found.amount = "Enter an amount greater than 0";
    } else if (amountNum > available) {
      found.amount = `Insufficient balance — available ${money(account.balance)}`;
    }
    if (modeInfo?.reference && !values.referenceNo.trim()) found.referenceNo = `Enter the ${modeInfo.reference}`;
    setErrors(found);
    if (Object.keys(found).length) return;

    if (
      !window.confirm(
        `Withdraw ${money(values.amount)} (${modeLabel(values.mode)}) from ${account.accountNo} — ${account.name}?\n\nBalance after: ${money(remaining ?? "0")}`,
      )
    ) {
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await authFetch<WithdrawalReceipt>("/api/withdrawals", {
        method: "POST",
        body: { accountNo: account.accountNo, ...values },
      });
      setReceipt(result);
      setAccount((a) =>
        a && {
          ...a,
          balance: result.balance,
          withdrawalCount: a.withdrawalCount + 1,
          totalWithdrawn: (Number(a.totalWithdrawn) + Number(result.amount)).toFixed(2),
          lastWithdrawalAt: result.withdrawnAt,
        },
      );
      setValues(EMPTY);
      onWithdrawn();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details as Errors);
      setFormError(errorMessage(err));
      // The balance may have changed meanwhile (another desk) — refresh it.
      if (err instanceof ApiError && err.details.amount) {
        authFetch<WithdrawalAccount>(`/api/withdrawals/accounts/${account.accountNo}`).then(setAccount, () => {});
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-navy">
        <Icon name="upload" className="size-6 text-amber-600" /> Withdraw Amount
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
                <span className="text-xs text-slate-500">Available </span>
                <b className="text-lg text-emerald-700">{money(account.balance)}</b>
              </span>
              <span className="self-end text-xs text-slate-500">
                Deposited {money(account.totalDeposited)} · Withdrawn {money(account.totalWithdrawn)}
                {account.lastWithdrawalAt && ` · last withdrawal ${formatDateTime(account.lastWithdrawalAt)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="checkCircle" className="size-5" /> Withdrawal recorded — pay out {money(receipt.amount)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <ReceiptItem label="Receipt No." value={receipt.receiptNo} mono />
            <ReceiptItem label="Amount" value={money(receipt.amount)} />
            <ReceiptItem label="Balance Left" value={money(receipt.balance)} />
            <ReceiptItem label="Mode" value={modeLabel(receipt.mode)} />
            <ReceiptItem label="Reference" value={receipt.referenceNo ?? "—"} mono />
            <ReceiptItem label="Date" value={formatDateTime(receipt.withdrawnAt)} />
            <ReceiptItem label="Paid By" value={receipt.createdBy} />
          </dl>
        </div>
      )}

      {/* Step 2 — amount */}
      {account &&
        (available <= 0 ? (
          <Alert tone="warning">This account has no balance to withdraw.</Alert>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 border-t border-slate-100 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-end justify-between">
                  <Label required>Amount (₹)</Label>
                  <button
                    type="button"
                    onClick={() => set("amount")(Number(account.balance).toFixed(2).replace(/\.00$/, ""))}
                    className="mb-1.5 text-xs font-medium text-brand hover:underline"
                  >
                    Full balance
                  </button>
                </div>
                <input
                  ref={amountRef}
                  className={`${inputCls(errors.amount)} text-base font-semibold`}
                  inputMode="decimal"
                  placeholder={`Up to ${money(account.balance)}`}
                  value={values.amount}
                  onChange={(e) =>
                    set("amount")(e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"))
                  }
                />
                {errors.amount ? (
                  <p className="mt-1 text-xs text-red-500">{errors.amount}</p>
                ) : (
                  remaining !== null && (
                    <p className={`mt-1 text-xs ${Number(remaining) < 0 ? "text-red-500" : "text-slate-500"}`}>
                      {Number(remaining) < 0
                        ? `Exceeds the available balance by ${money(String(-Number(remaining)))}`
                        : `Balance after: ${money(remaining)}`}
                    </p>
                  )
                )}
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
                  {PAYMENT_MODES.map((m) => (
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
                  placeholder="Optional, e.g. Medical expenses"
                  maxLength={200}
                  value={values.remarks}
                  onChange={(e) => set("remarks")(e.target.value)}
                />
                {errors.remarks && <p className="mt-1 text-xs text-red-500">{errors.remarks}</p>}
              </div>
            </div>

            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Withdrawals can&apos;t be edited or deleted once recorded.</p>
              <button
                type="submit"
                disabled={saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-7 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-70"
              >
                {saving ? <Spinner /> : <Icon name="upload" className="size-4" />}
                {saving ? "Saving…" : values.amount && amountNum > 0 ? `Withdraw ${money(values.amount)}` : "Withdraw"}
              </button>
            </div>
          </form>
        ))}
    </section>
  );
}

/* =============================== History =============================== */

const PAGE_SIZE = 15;

function WithdrawalHistory({ version, accountNo }: { version: number; accountNo: string | null }) {
  const { authFetch } = useAuth();
  const [onlyAccount, setOnlyAccount] = useState(true);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const filterAccount = onlyAccount ? accountNo : null;
  const key = `${filterAccount}|${q}|${page}|${version}`;
  const [result, setResult] = useState<{ key: string; data: WithdrawalPage | null; error: string | null }>({
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
    authFetch<WithdrawalPage>(`/api/withdrawals?${params}`, { signal: controller.signal }).then(
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
          {filterAccount ? `Withdrawals — ${filterAccount}` : "Recent Withdrawals"}
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
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt / Date</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((w) => (
                <tr key={w.receiptNo}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-medium text-navy">{w.receiptNo}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(w.withdrawnAt)} · {w.createdBy}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/accounts/${w.accountNo}`} className="font-medium text-navy hover:underline">
                      {w.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">{w.accountNo}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {modeLabel(w.mode)}
                    {w.referenceNo && <p className="font-mono text-[11px] text-slate-500">{w.referenceNo}</p>}
                    {w.remarks && <p className="text-[11px] text-slate-500">{w.remarks}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-red-600">−{money(w.amount)}</td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-slate-600">{money(w.balanceAfter)}</td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    {q || filterAccount ? "No withdrawals match." : "No withdrawals yet."}
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
            Page {data.page} of {pages} · {data.total} withdrawals
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
