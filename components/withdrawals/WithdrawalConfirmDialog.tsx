"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/accounts/types";
import { modeLabel, money } from "@/lib/deposits/types";
import type { PaymentMode, WithdrawalQuote } from "@/lib/withdrawals/types";

/**
 * Confirmation popup before paying out, filled with the server's quote
 * (GET …/quote), so the cashier confirms exactly what the backend will apply:
 *   * NORMAL — "Confirm Withdrawal": amount, full payout, balance after;
 *   * EARLY  — "Early Withdrawal": why it is early, the deduction, the reduced
 *     payout, and a required tick that the holder was told about the deduction.
 * Esc / Cancel / backdrop close it (not while saving).
 */
export function WithdrawalConfirmDialog({
  quote,
  mode,
  referenceNo,
  saving,
  onConfirm,
  onCancel,
}: {
  quote: WithdrawalQuote;
  mode: PaymentMode;
  referenceNo: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const early = quote.type === "EARLY";
  const rate = Number(quote.penaltyRate);
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus: the safe button for an early withdrawal, the confirm button otherwise.
  useEffect(() => {
    (early ? cancelRef : confirmRef).current?.focus();
  }, [early]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel, saving]);

  const canConfirm = !saving && (!early || acknowledged);
  const title = early ? "Early Withdrawal" : "Confirm Withdrawal";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
      onClick={() => !saving && onCancel()}
    >
      <div
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          className={`flex items-start gap-3 border-b px-5 py-4 ${
            early ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"
          }`}
        >
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              early ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand"
            }`}
          >
            <Icon name={early ? "info" : "upload"} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="withdrawal-confirm-title" className="font-semibold text-navy">
              {title}
            </h2>
            <p className="truncate text-xs text-slate-600">
              <span className="font-mono">{quote.accountNo}</span> — {quote.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <Icon name="x" className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {early && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
              <p className="font-medium">
                {rate}% of the amount is deducted because a normal withdrawal isn&apos;t available yet:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {quote.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* the money */}
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            <Row label="Withdrawal amount" hint="debited from the account">
              {money(quote.amount)}
            </Row>
            {early && (
              <Row label={`Early withdrawal deduction (${rate}%)`} tone="bad">
                −{money(quote.penalty)}
              </Row>
            )}
            <Row label="Pay out to holder" strong>
              {money(quote.netAmount)}
            </Row>
          </dl>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Item label="Balance now">
              {money(quote.balanceBefore)}
              <span className="block text-[11px] font-normal text-slate-500">
                Principal {money(quote.principalBefore)} + Interest {money(quote.interestBefore)}
              </span>
            </Item>
            <Item label="Balance after">{money(quote.balanceAfter)}</Item>
            <Item label="Mode">
              {modeLabel(mode)}
              {referenceNo && <span className="block font-mono text-[11px] font-normal text-slate-500">{referenceNo}</span>}
            </Item>
            <Item label="Next normal withdrawal">{formatDate(quote.nextWithdrawalOn)}</Item>
            {quote.durationMonths !== null && (
              <Item label="Deposit months this cycle">
                {quote.completedMonths}/{quote.durationMonths} paid
                {quote.missedMonths ? ` · ${quote.missedMonths} missed` : ""}
              </Item>
            )}
            {early && quote.eligibleFrom && <Item label="Normal withdrawal would be from">{formatDate(quote.eligibleFrom)}</Item>}
          </dl>

          <p className="text-xs text-slate-500">
            A new deposit cycle starts with this withdrawal. Withdrawals can&apos;t be edited or deleted once recorded.
          </p>

          {early && (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-navy">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                I have told the holder that {money(quote.penalty)} ({rate}%) is deducted and they receive{" "}
                <b>{money(quote.netAmount)}</b>.
              </span>
            </label>
          )}
        </div>

        {/* actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-200 px-6 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg px-6 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${
              early ? "bg-amber-600 hover:bg-amber-700" : "bg-brand hover:bg-brand-dark"
            }`}
          >
            {saving ? <Spinner /> : <Icon name="check" className="size-4" />}
            {saving ? "Saving…" : early ? `Confirm Early Withdrawal` : `Withdraw ${money(quote.amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  tone,
  strong,
  children,
}: {
  label: string;
  hint?: string;
  tone?: "bad";
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-3 py-2.5 ${strong ? "bg-emerald-50" : ""}`}>
      <dt className={strong ? "font-semibold text-emerald-900" : "text-slate-600"}>
        {label}
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </dt>
      <dd
        className={`text-right whitespace-nowrap ${
          strong ? "text-lg font-bold text-emerald-700" : tone === "bad" ? "font-semibold text-red-600" : "font-semibold text-navy"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-navy">{children}</dd>
    </div>
  );
}
