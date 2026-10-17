"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ModalForm as Dialog } from "@/components/ui/ModalForm";
import { Alert, Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import type { StatementEntry, TransactionCorrectionEntry } from "@/lib/accounts/types";
import { DEPOSIT_MODES, modeLabel, money } from "@/lib/deposits/types";

/*
 * Super Admin corrections of a transaction (PATCH / DELETE /api/admin/transactions/:receiptNo)
 * and interest added by hand (POST /api/admin/accounts/:accountNo/interest). The database
 * enforces who, when (the correction window) and that no balance goes below zero; these
 * dialogs collect the values and the reason, which is kept with every correction.
 */

type Done = (message: string) => void;

export function EditTransactionDialog({ entry, onDone, onCancel }: { entry: StatementEntry; onDone: Done; onCancel: () => void }) {
  const { authFetch } = useAuth();
  const interest = entry.kind === "INTEREST";
  const original = entry.type === "WITHDRAWAL" ? entry.debit : entry.credit;
  const [amount, setAmount] = useState(Number(original).toFixed(2));
  const [mode, setMode] = useState(entry.mode);
  const [referenceNo, setReferenceNo] = useState(entry.referenceNo ?? "");
  const [remarks, setRemarks] = useState(entry.remarks ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsRef = !interest && mode !== "CASH";
  const diff = Number(amount.replace(/,/g, "")) - Number(original);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const r = await authFetch<{ amountBefore: string; amountAfter: string; balanceAfter: string }>(
        `/api/admin/transactions/${encodeURIComponent(entry.receiptNo)}`,
        { method: "PATCH", body: { amount: amount.replace(/,/g, ""), mode, referenceNo: needsRef ? referenceNo : "", remarks, reason } },
      );
      onDone(`${entry.receiptNo} corrected: ${money(r.amountBefore)} → ${money(r.amountAfter)}. Balance now ${money(r.balanceAfter)}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Edit ${entry.type === "WITHDRAWAL" ? "withdrawal" : interest ? "interest" : "deposit"}`} subtitle={entry.receiptNo}
      icon="settings" saving={saving} onCancel={onCancel} onSubmit={submit} submitLabel="Save correction">
      <WindowNote entry={entry} />
      <Field label="Amount (₹)" required htmlFor="corr-amount" error={errors.amount}
        hint={Number.isFinite(diff) && diff !== 0 ? <>Was {money(original)} — {diff > 0 ? "+" : "−"}{money(String(Math.abs(diff)))}{entry.type === "DEPOSIT" && entry.kind !== "INTEREST" ? "; referral commission is recalculated" : ""}</> : undefined}>
        <input id="corr-amount" inputMode="decimal" value={amount} disabled={saving}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className={inputCls(errors.amount)} />
      </Field>
      {!interest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mode" required htmlFor="corr-mode" error={errors.mode}>
            <select id="corr-mode" value={mode} disabled={saving} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputCls(errors.mode)}>
              {DEPOSIT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          {needsRef && (
            <Field label="Reference no." required htmlFor="corr-ref" error={errors.referenceNo}>
              <input id="corr-ref" value={referenceNo} maxLength={40} disabled={saving} onChange={(e) => setReferenceNo(e.target.value)} className={inputCls(errors.referenceNo)} />
            </Field>
          )}
        </div>
      )}
      <Field label="Remarks" optional htmlFor="corr-remarks" error={errors.remarks}>
        <input id="corr-remarks" value={remarks} maxLength={200} disabled={saving} onChange={(e) => setRemarks(e.target.value)} className={inputCls(errors.remarks)} />
      </Field>
      <ReasonField value={reason} onChange={setReason} error={errors.reason} disabled={saving} />
      {error && !Object.keys(errors).length && <Alert tone="error">{error}</Alert>}
    </Dialog>
  );
}

export function DeleteTransactionDialog({ entry, onDone, onCancel }: { entry: StatementEntry; onDone: Done; onCancel: () => void }) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amount = entry.type === "WITHDRAWAL" ? entry.debit : entry.credit;

  const submit = async () => {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const r = await authFetch<{ balanceAfter: string; commissionRemoved: number }>(
        `/api/admin/transactions/${encodeURIComponent(entry.receiptNo)}`, { method: "DELETE", body: { reason } });
      onDone(`${entry.receiptNo} deleted. Balance now ${money(r.balanceAfter)}${r.commissionRemoved ? `; ${r.commissionRemoved} referral commission entr${r.commissionRemoved === 1 ? "y" : "ies"} removed` : ""}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Delete ${entry.type === "WITHDRAWAL" ? "withdrawal" : "deposit"}`} subtitle={entry.receiptNo} icon="x" danger
      saving={saving} onCancel={onCancel} onSubmit={submit} submitLabel="Delete transaction">
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        <Row label="Amount">{entry.type === "WITHDRAWAL" ? "−" : "+"}{money(amount)}</Row>
        <Row label="Made">{formatDateTime(entry.at)} · {modeLabel(entry.mode)}</Row>
        <Row label="By">{entry.createdBy}</Row>
      </dl>
      <p className="text-sm text-slate-600">
        The account is recalculated without it{entry.type === "DEPOSIT" ? " and the referral commission it paid is removed" : ""}.
        The deleted entry stays in the corrections history.
      </p>
      <WindowNote entry={entry} />
      <ReasonField value={reason} onChange={setReason} error={errors.reason} disabled={saving} />
      {error && !Object.keys(errors).length && <Alert tone="error">{error}</Alert>}
    </Dialog>
  );
}

export function AddInterestDialog({ accountNo, name, onDone, onCancel }: { accountNo: string; name?: string; onDone: Done; onCancel: () => void }) {
  const { authFetch } = useAuth();
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const r = await authFetch<{ receiptNo: string; amount: string; balance: string }>(
        `/api/admin/accounts/${encodeURIComponent(accountNo)}/interest`,
        { method: "POST", body: { amount: amount.replace(/,/g, ""), remarks: remarks || null } });
      onDone(`Interest of ${money(r.amount)} added (${r.receiptNo}). Balance now ${money(r.balance)}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog title="Add interest" subtitle={`${accountNo}${name ? ` — ${name}` : ""}`} icon="gift"
      saving={saving} onCancel={onCancel} onSubmit={submit} submitLabel="Add interest">
      <p className="text-sm text-slate-600">
        Credited as an interest entry (accrued interest, not principal). It pays no referral commission and is recorded in the audit log.
      </p>
      <Field label="Interest amount (₹)" required htmlFor="int-amount" error={errors.amount}>
        <input id="int-amount" inputMode="decimal" value={amount} disabled={saving} placeholder="0.00"
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className={inputCls(errors.amount)} />
      </Field>
      <Field label="Remarks" optional htmlFor="int-remarks" error={errors.remarks} hint="Shown on the statement after “Interest added by Super Admin”">
        <input id="int-remarks" value={remarks} maxLength={170} disabled={saving} placeholder="e.g. Festival bonus"
          onChange={(e) => setRemarks(e.target.value)} className={inputCls(errors.remarks)} />
      </Field>
      {error && !Object.keys(errors).length && <Alert tone="error">{error}</Alert>}
    </Dialog>
  );
}

/** Every Super Admin edit / delete of this account's transactions, newest first. */
export function CorrectionHistory({ accountNo }: { accountNo: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<{ total: number; items: TransactionCorrectionEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<{ total: number; items: TransactionCorrectionEntry[] }>(
      `/api/admin/transaction-corrections?accountNo=${encodeURIComponent(accountNo)}&pageSize=50`, { signal: controller.signal },
    ).then((d) => { setData(d); setError(null); }, (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); });
    return () => controller.abort();
  }, [authFetch, accountNo]);

  if (!error && (!data || data.total === 0)) return null;   // nothing corrected: no section
  return (
    <section className="rounded-2xl border border-amber-200 bg-white">
      <h2 className="flex items-center gap-2 border-b border-amber-100 px-5 py-4 font-semibold text-navy sm:px-6">
        <Icon name="clipboard" className="size-5 text-amber-600" /> Corrections by the Super Admin
        {data && <span className="text-sm font-normal text-slate-500">({data.total})</span>}
      </h2>
      {error && <div className="p-5"><Alert tone="error">{error}</Alert></div>}
      <ul className="divide-y divide-slate-100">
        {data?.items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                  {c.action === "DELETE" ? "DELETED" : "EDITED"}
                </span>
                <span className="font-mono text-xs text-navy">{c.receiptNo}</span>
                <span className="text-xs text-slate-500">{c.type === "WITHDRAWAL" ? "withdrawal" : "deposit"}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {c.action === "DELETE" ? <>{money(c.amountBefore)} removed</> : <>{money(c.amountBefore)} → <b>{money(c.amountAfter ?? "0")}</b></>}
                {c.after && c.after.mode !== c.before.mode && <> · {modeLabel(c.before.mode as never)} → {modeLabel(c.after.mode as never)}</>}
                {c.commissionRemoved > 0 && <span className="text-xs text-slate-500"> · {c.commissionRemoved} commission entr{c.commissionRemoved === 1 ? "y" : "ies"} replaced</span>}
              </p>
              <p className="text-xs text-slate-600">Reason: {c.reason}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{formatDateTime(c.at)}</p>
              <p>by {c.by}</p>
              <p>balance {money(c.balanceBefore)} → {money(c.balanceAfter)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---- small pieces ------------------------------------------------------------------ */

function WindowNote({ entry }: { entry: StatementEntry }) {
  if (!entry.correction?.until) return null;
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <Icon name="info" className="size-3.5 shrink-0 text-brand" /> Can be corrected until {formatDateTime(entry.correction.until)}
    </p>
  );
}

function ReasonField({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: string; disabled: boolean }) {
  return (
    <Field label="Reason" required htmlFor="corr-reason" error={error} hint="Kept with the correction for the audit trail">
      <input id="corr-reason" value={value} maxLength={200} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Wrong amount entered" className={inputCls(error)} />
    </Field>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy">{children}</dd>
    </div>
  );
}
