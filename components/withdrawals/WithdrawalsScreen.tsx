"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate } from "@/lib/accounts/types";
import { formatDateTime } from "@/lib/auth/types";
import { DEPOSIT_MODES as PAYMENT_MODES, modeLabel, money } from "@/lib/deposits/types";
import type {
  PaymentMode,
  PenaltyReceipt,
  WithdrawalAccount,
  WithdrawalPage,
  WithdrawalQuote,
  WithdrawalReceipt,
} from "@/lib/withdrawals/types";
import { WithdrawalConfirmDialog } from "./WithdrawalConfirmDialog";

/** "rs 110033 000001" / "110033000001" → "RS110033000001" */
const normaliseAccountNo = (v: string) => {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{12}$/.test(s) ? `RS${s}` : s;
};

/** Display only — the server computes the real deduction: round(amount × rate / 100, 2). */
const deduction = (amount: number, rate: string) => Math.round(Math.round(amount * 100) * Number(rate) / 100) / 100;

/**
 * Withdrawals screen: the withdrawal desk (find account → deposit-cycle status
 * → collect any outstanding missed-month penalty → amount ≤ available
 * balance (principal + interest) → NORMAL or EARLY (20 % deducted while the
 * cycle isn't complete) → receipt) and the withdrawal history.
 * Paying out refreshes the history. The backend decides all of it.
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
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null); // open confirmation popup
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
  const terms = account?.withdrawalToday;
  const early = terms?.type === "EARLY";
  const penalty = early && amountNum > 0 ? deduction(amountNum, terms.penaltyRate) : 0;
  const payout = amountNum > 0 ? (amountNum - penalty).toFixed(2) : null;

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

    // Ask the server what this withdrawal would do, then confirm it in the popup.
    setQuoting(true);
    setFormError(null);
    try {
      const params = new URLSearchParams({ amount: values.amount });
      setQuote(await authFetch<WithdrawalQuote>(`/api/withdrawals/accounts/${account.accountNo}/quote?${params}`));
    } catch (err) {
      failed(err);
    } finally {
      setQuoting(false);
    }
  };

  /** Popup confirmed → record the withdrawal (the backend re-checks it against the quote). */
  const pay = async () => {
    if (!account || !quote) return;
    setSaving(true);
    try {
      const result = await authFetch<WithdrawalReceipt>("/api/withdrawals", {
        method: "POST",
        // what the cashier confirmed — the server refuses (409) if today's terms differ
        body: { accountNo: account.accountNo, ...values, expectedType: quote.type, expectedPenalty: quote.penalty },
      });
      setQuote(null);
      setReceipt(result);
      setValues(EMPTY);
      onWithdrawn();
      // Balance, principal / interest and the deposit cycle all changed — reload them.
      authFetch<WithdrawalAccount>(`/api/withdrawals/accounts/${account.accountNo}`).then(setAccount, () => {});
    } catch (err) {
      setQuote(null);
      failed(err);
    } finally {
      setSaving(false);
    }
  };

  /** Show the error on the form; the balance, cycle or penalty may have changed meanwhile — refresh them. */
  function failed(err: unknown) {
    if (err instanceof ApiError && (err.code === "VALIDATION_ERROR" || err.code === "PENALTY_OUTSTANDING")) {
      setErrors(err.details as Errors);
    }
    setFormError(errorMessage(err));
    if (account && err instanceof ApiError && (err.details.amount || err.code === "WITHDRAWAL_TERMS_CHANGED")) {
      authFetch<WithdrawalAccount>(`/api/withdrawals/accounts/${account.accountNo}`).then(setAccount, () => {});
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:p-6">
      {quote && (
        <WithdrawalConfirmDialog
          quote={quote}
          mode={values.mode}
          referenceNo={values.referenceNo}
          saving={saving}
          onConfirm={pay}
          onCancel={() => setQuote(null)}
        />
      )}
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
                Principal {money(account.principalBalance)} + Interest {money(account.accruedInterest)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Deposited {money(account.totalDeposited)} · Withdrawn {money(account.totalWithdrawn)}
              {account.lastWithdrawalAt && ` · last withdrawal ${formatDateTime(account.lastWithdrawalAt)}`}
            </p>
          </div>
        </div>
      )}

      {account && terms && <CycleStatus account={account} />}

      {account && terms && !terms.allowed && account.cycle && (
        <PenaltyDesk
          account={account}
          onPaid={() =>
            authFetch<WithdrawalAccount>(`/api/withdrawals/accounts/${account.accountNo}`).then(setAccount, () => {})
          }
        />
      )}

      {receipt && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="checkCircle" className="size-5" /> Withdrawal recorded — pay out {money(receipt.netAmount)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <ReceiptItem label="Receipt No." value={receipt.receiptNo} mono />
            <ReceiptItem label="Type" value={receipt.type === "EARLY" ? "Early" : "Normal"} />
            <ReceiptItem label="Balance Before" value={money(receipt.balanceBefore)} />
            <ReceiptItem label="Withdrawn" value={money(receipt.amount)} />
            <ReceiptItem
              label={`Deduction (${Number(receipt.penaltyRate)}%)`}
              value={Number(receipt.penalty) > 0 ? `−${money(receipt.penalty)}` : money(receipt.penalty)}
            />
            <ReceiptItem label="Paid Out" value={money(receipt.netAmount)} />
            <ReceiptItem label="Balance Left" value={money(receipt.balance)} />
            <ReceiptItem label="Next Normal Withdrawal" value={formatDate(receipt.nextWithdrawalOn)} />
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
        ) : !terms?.allowed ? null : (
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
                        : early
                          ? `Deduction ${Number(terms.penaltyRate)}%: ${money(penalty.toFixed(2))} · Pay out ${money(payout ?? "0")} · Balance after ${money(remaining)}`
                          : `Pay out ${money(payout ?? "0")} · Balance after ${money(remaining)}`}
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
                disabled={saving || quoting}
                className="flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-7 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-70"
              >
                {quoting ? <Spinner /> : <Icon name="upload" className="size-4" />}
                {quoting ? "Checking…" : values.amount && amountNum > 0 ? `Withdraw ${money(values.amount)}` : "Withdraw"}
              </button>
            </div>
          </form>
        ))}
    </section>
  );
}

/* ============================ Cycle status ============================ */

/** Deposit cycle summary at the desk: why the withdrawal is NORMAL or EARLY, or blocked. */
function CycleStatus({ account }: { account: WithdrawalAccount }) {
  const t = account.withdrawalToday;
  const c = account.cycle;
  return (
    <div className="space-y-3">
      {c && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3 text-xs sm:grid-cols-4">
          <CycleItem label="Deposit Cycle" value={`${formatDate(c.startOn)} – ${formatDate(c.endOn)}`} />
          <CycleItem label="Deposit Months" value={`${c.completedMonths}/${c.durationMonths} paid`} />
          <CycleItem label="Missed Months" value={String(c.missedMonths)} bad={c.missedMonths > 0} />
          <CycleItem
            label="Outstanding Penalty"
            value={money(c.outstandingPenalty)}
            bad={Number(c.outstandingPenalty) > 0}
          />
        </dl>
      )}
      {!t.allowed ? (
        <Alert tone="error">
          <b>Withdrawal blocked</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {t.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Alert>
      ) : t.type === "EARLY" ? (
        <Alert tone="warning">
          <b>Early withdrawal</b> — {Number(t.penaltyRate)}% of the amount withdrawn today is deducted; the full amount
          leaves the account.
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {t.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="info">
          <b>Normal withdrawal</b> — no deduction. The deposit cycle is complete
          {c ? ` (${c.completedMonths}/${c.durationMonths} months)` : ""}. A new {account.rules.minDurationMonths}-month
          cycle starts with this withdrawal.
        </Alert>
      )}
    </div>
  );
}

function CycleItem({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold ${bad ? "text-red-600" : "text-navy"}`}>{value}</dd>
    </div>
  );
}

/* ============================ Penalty desk ============================ */

type PenaltyValues = { amount: string; mode: PaymentMode; referenceNo: string; remarks: string };

/**
 * Collect the outstanding missed-month penalty. Recorded in its own ledger
 * with a PEN receipt — not a deposit, and the balance doesn't change.
 */
function PenaltyDesk({ account, onPaid }: { account: WithdrawalAccount; onPaid: () => void }) {
  const { authFetch } = useAuth();
  const cycle = account.cycle!;
  const [values, setValues] = useState<PenaltyValues>({
    amount: Number(cycle.outstandingPenalty).toString(),
    mode: "CASH",
    referenceNo: "",
    remarks: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PenaltyValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<PenaltyReceipt | null>(null);
  const modeInfo = PAYMENT_MODES.find((m) => m.value === values.mode);
  const outstanding = Number(cycle.outstandingPenalty);
  const amountNum = Number(values.amount);

  const set = (field: keyof PenaltyValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.amount) || amountNum <= 0) found.amount = "Enter an amount greater than 0";
    else if (amountNum > outstanding) found.amount = `More than the outstanding penalty (${money(cycle.outstandingPenalty)})`;
    if (modeInfo?.reference && !values.referenceNo.trim()) found.referenceNo = `Enter the ${modeInfo.reference}`;
    setErrors(found);
    if (Object.keys(found).length) return;
    if (
      !window.confirm(
        `Collect missed-month penalty ${money(values.amount)} (${modeLabel(values.mode)}) from ${account.accountNo} — ${account.name}?\n\n` +
          `${cycle.missedMonths} missed month(s) × ${money(cycle.penaltyPerMonth)} · outstanding ${money(cycle.outstandingPenalty)}\n` +
          `This is not a deposit; the account balance does not change.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await authFetch<PenaltyReceipt>("/api/withdrawals/penalties", {
        method: "POST",
        body: { accountNo: account.accountNo, ...values },
      });
      setReceipt(result);
      onPaid();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details as typeof errors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (receipt) {
    return (
      <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold">
          <Icon name="checkCircle" className="size-5" /> Penalty collected — {money(receipt.amount)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <ReceiptItem label="Receipt No." value={receipt.receiptNo} mono />
          <ReceiptItem label="Missed Months" value={String(receipt.missedMonths)} />
          <ReceiptItem label="Still Outstanding" value={money(receipt.outstandingAfter)} />
          <ReceiptItem label="Mode" value={modeLabel(receipt.mode)} />
          <ReceiptItem label="Date" value={formatDateTime(receipt.paidAt)} />
          <ReceiptItem label="Collected By" value={receipt.createdBy} />
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h3 className="text-sm font-semibold text-navy">
        Collect missed-month penalty — {cycle.missedMonths} × {money(cycle.penaltyPerMonth)} = {money(cycle.totalPenalty)}
        {Number(cycle.penaltyPaid) > 0 && ` (paid ${money(cycle.penaltyPaid)})`}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label required>Amount (₹)</Label>
          <input
            className={inputCls(errors.amount)}
            inputMode="decimal"
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
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {modeInfo?.reference && (
          <div className="sm:col-span-2">
            <Label required>{modeInfo.reference}</Label>
            <input
              className={`${inputCls(errors.referenceNo)} font-mono`}
              maxLength={40}
              value={values.referenceNo}
              onChange={(e) => set("referenceNo")(e.target.value.replace(/[^A-Za-z0-9/-]/g, ""))}
            />
            {errors.referenceNo && <p className="mt-1 text-xs text-red-500">{errors.referenceNo}</p>}
          </div>
        )}
      </div>
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Separate receipt; not a deposit and not added to the balance.</p>
        <button
          type="submit"
          disabled={saving}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-70"
        >
          {saving ? <Spinner /> : <Icon name="handCoins" className="size-4" />}
          {saving ? "Saving…" : `Collect ${money(values.amount || "0")}`}
        </button>
      </div>
    </form>
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
                <th className="px-4 py-3 text-right font-medium">Amount / Paid</th>
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <p className="font-semibold text-red-600">−{money(w.amount)}</p>
                    {w.type === "EARLY" ? (
                      <p className="text-[11px] text-amber-700">
                        Early −{money(w.penalty)} · paid {money(w.netAmount)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">paid {money(w.netAmount)}</p>
                    )}
                  </td>
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
