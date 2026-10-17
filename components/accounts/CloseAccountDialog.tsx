"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ModalForm as Dialog } from "@/components/ui/ModalForm";
import { Alert, Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate } from "@/lib/accounts/types";
import { money } from "@/lib/deposits/types";
import type { ClosureBlocker, ClosureQuote, ClosureReceipt } from "@/lib/withdrawals/types";

/** The conditions shown as a checklist; each fails when the server lists its blocker code. */
const CHECKS: { code: ClosureBlocker["code"]; label: string }[] = [
  { code: "ACTIVE_CYCLE", label: "Deposit cycle completed or ended by an early settlement" },
  { code: "BALANCE", label: "Account balance is ₹0 (complete balance withdrawn)" },
  { code: "PENALTY", label: "Missed-deposit penalties paid" },
  { code: "PENDING_DEPOSIT", label: "No pending deposit" },
  { code: "COMMISSION", label: "Advisor commission paid out" },
  { code: "INTEREST", label: "Month-end interest finalised" },
];

/**
 * Close an account (POST /api/withdrawals/accounts/:accountNo/close). An account
 * is never closed while money or an obligation remains: first the complete
 * balance is withdrawn at the withdrawal desk — NORMAL once the 6-month cycle is
 * complete, otherwise an EARLY settlement with the deduction — then, with every
 * check passed, the account is closed. The closure itself pays nothing.
 */
export function CloseAccountDialog({ accountNo, name, onDone, onCancel }: {
  accountNo: string;
  name: string;
  onDone: (receipt: ClosureReceipt) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [quote, setQuote] = useState<ClosureQuote | null>(null);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    authFetch<ClosureQuote>(`/api/withdrawals/accounts/${encodeURIComponent(accountNo)}/closure`)
      .then(setQuote, (err) => setError(errorMessage(err)));
  };
  useEffect(load, [authFetch, accountNo]);

  const blocked = new Set(quote?.blockers.map((b) => b.code));
  const active = quote?.blockers.find((b) => b.code === "ACTIVE_CYCLE");

  const submit = async () => {
    if (!quote?.canClose) return; // the button is disabled until the account is settled
    const found: Record<string, string> = {};
    if (reason.trim().length < 3) found.reason = "Enter the reason for closing (at least 3 characters)";
    if (!confirmed) found.confirm = "Confirm that the account is closed";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setError(null);
    try {
      onDone(await authFetch<ClosureReceipt>(`/api/withdrawals/accounts/${encodeURIComponent(accountNo)}/close`, {
        method: "POST",
        body: { reason: reason.trim(), remarks: remarks || null },
      }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
      load(); // something changed meanwhile — show the current checks
    }
  };

  const s = quote?.settlement;
  const settleHref = `/admin/withdrawals?accountNo=${encodeURIComponent(accountNo)}&settle=1`;

  return (
    <Dialog title="Close account" subtitle={`${accountNo} — ${name}`} icon="lock" danger
      saving={saving} onCancel={onCancel} onSubmit={submit} submitLabel="Close account"
      submitDisabled={!quote?.canClose}
      submitTitle="Not applicable yet — settle the account first (every check must be met)">
      {!quote ? (
        error ? <Alert tone="error">{error}</Alert> : <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
      ) : (
        <>
          {active ? (
            <Alert tone="warning">{active.message}</Alert>
          ) : !quote.canClose ? (
            <Alert tone="warning">The account isn&apos;t fully settled yet — it can be closed once every check below is met.</Alert>
          ) : (
            <Alert tone="success">The account is fully settled. It can be closed now.</Alert>
          )}

          <ul className="space-y-1.5 rounded-lg border border-slate-200 p-3 text-sm">
            {CHECKS.map((c) => {
              const why = quote.blockers.find((b) => b.code === c.code);
              return (
                <li key={c.code} className="flex items-start gap-2">
                  <Icon name={why ? "x" : "check"} className={`mt-0.5 size-4 shrink-0 ${why ? "text-red-600" : "text-emerald-600"}`} />
                  <span>
                    <span className={why ? "font-medium text-navy" : "text-slate-600"}>{c.label}</span>
                    {why && c.code !== "ACTIVE_CYCLE" && <span className="block text-xs text-red-700">{why.message}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          {s && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-navy">
                Settlement needed — {s.type === "EARLY" ? "early settlement" : "final withdrawal (cycle complete)"}
              </p>
              <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                <Row label="Principal">{money(quote.balance.principal)}</Row>
                <Row label="Accumulated interest">{money(quote.balance.accruedInterest)}</Row>
                <Row label="Total balance">{money(s.amount)}</Row>
                <Row label={s.type === "EARLY" ? `Early-settlement deduction (${Number(s.deductionRate)}%)` : "Deduction"}>
                  {Number(s.deduction) > 0 ? `−${money(s.deduction)}` : money("0")}
                </Row>
                <Row label={<b>Paid to the holder</b>}><b className="text-base text-navy">{money(s.payable)}</b></Row>
              </dl>
              {quote.cycle && (
                <p className="text-xs text-slate-500">
                  Active cycle since {formatDate(quote.cycle.startOn)} — {s.type === "EARLY"
                    ? `it completes on ${formatDate(quote.cycle.eligibleOn)}; settling now ends it early.`
                    : "complete; the settlement withdrawal ends it."}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {blocked.has("PENALTY") && (
                  <Link href={`/admin/withdrawals?accountNo=${encodeURIComponent(accountNo)}`}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                    1. Pay the penalty
                  </Link>
                )}
                <Link href={settleHref}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700">
                  <Icon name="upload" className="size-3.5" /> {blocked.has("PENALTY") ? "2. " : ""}Withdraw the complete balance
                </Link>
              </div>
            </div>
          )}
          {blocked.has("COMMISSION") && (
            <Link href="/admin/advisor-commission" className="inline-block text-xs font-medium text-brand underline">
              Pay the advisor commission ({money(quote.balance.commission)})
            </Link>
          )}

          {quote.canClose && (
            <>
              <Field label="Reason for closing" required htmlFor="close-reason" error={errors.reason}>
                <input id="close-reason" value={reason} maxLength={200} disabled={saving} placeholder="e.g. Requested by the account holder"
                  onChange={(e) => setReason(e.target.value)} className={inputCls(errors.reason)} />
              </Field>
              <Field label="Remarks" optional htmlFor="close-remarks" error={errors.remarks}>
                <input id="close-remarks" value={remarks} maxLength={200} disabled={saving} onChange={(e) => setRemarks(e.target.value)} className={inputCls(errors.remarks)} />
              </Field>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={confirmed} disabled={saving} onChange={(e) => { setConfirmed(e.target.checked); setErrors((x) => ({ ...x, confirm: "" })); }} className="mt-0.5 accent-red-600" />
                <span>I confirm the account is settled and should be closed. A later deposit would resume it.</span>
              </label>
              {errors.confirm && <p className="-mt-2 text-xs text-red-600">{errors.confirm}</p>}
            </>
          )}
          {error && <Alert tone="error">{error}</Alert>}
        </>
      )}
    </Dialog>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right text-navy">{children}</dd>
    </div>
  );
}
