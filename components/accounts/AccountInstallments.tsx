"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatDate, type Installment, type InstallmentSchedule } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { accountTypeLabel, money } from "@/lib/deposits/types";

/**
 * Account page → installments: each due date (daily / weekly / monthly from
 * the opening day, by account type), the last day of its buffer, when it was paid and whether a fine is
 * applicable. The rule itself lives in the DB (accounts.fn_is_fine_applicable).
 */
export function AccountInstallments({ accountNo, totalInterest }: { accountNo: string; totalInterest: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<InstallmentSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<InstallmentSchedule>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/installments`, {
      signal: controller.signal,
    }).then(setData, (err) => {
      if ((err as Error).name !== "AbortError") setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [authFetch, accountNo]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="calendar" className="size-5 text-brand" /> Interest &amp; Installments
        </h2>
        {data && data.finesApplicable > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
            Fine applicable on {data.finesApplicable} installment{data.finesApplicable === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error ? (
        <div className="p-5 sm:p-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : !data ? (
        <div className="m-5 h-24 animate-pulse rounded-lg bg-slate-100 sm:m-6" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-5">
            <Stat label="Account Type" value={accountTypeLabel(data.accountType)} />
            <Stat label="Opened On" value={formatDate(data.openedOn)} />
            <Stat label="Interest Rate" value={`${data.interestRate}% per month`} />
            <Stat label="Buffer" value={`${data.bufferDays} day${data.bufferDays === 1 ? "" : "s"} after due date`} />
            <Stat label="Interest Credited" value={money(totalInterest)} />
          </dl>
          {/* daily accounts have one row per day — keep the list scrollable */}
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">No.</th>
                  <th className="px-4 py-3 font-medium">Due On</th>
                  <th className="px-4 py-3 font-medium">Pay By (buffer)</th>
                  <th className="px-4 py-3 font-medium">Paid On</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((i) => (
                  <tr key={i.installmentNo}>
                    <td className="px-4 py-3 text-slate-700">{i.installmentNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-navy">{formatDate(i.dueOn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(i.bufferEndsOn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{i.paidOn ? formatDate(i.paidOn) : "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-navy">
                      {Number(i.amountPaid) > 0 ? money(i.amountPaid) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge installment={i} />
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No installments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

function StatusBadge({ installment: i }: { installment: Installment }) {
  const [label, cls] = i.fineApplicable
    ? ["Fine applicable", "bg-red-50 text-red-700 ring-red-200"]
    : i.paidOn
      ? ["Paid", "bg-emerald-50 text-emerald-700 ring-emerald-200"]
      : today() <= i.dueOn
        ? ["Upcoming", "bg-slate-50 text-slate-600 ring-slate-200"]
        : ["In buffer", "bg-amber-50 text-amber-700 ring-amber-200"];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-3 sm:px-6">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-navy">{value}</dd>
    </div>
  );
}
