"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { money } from "@/lib/deposits/types";
import { monthLabel, type AccountInterest } from "@/lib/interest/types";

/**
 * Account page → month-end interest statement (interest-service). Every
 * calendar month: previous balance + deposits − withdrawals = month-end
 * balance, interest on it at the account's rate, closing balance. The running
 * month is shown on top with the interest it would earn so far.
 */
export function AccountMonthlyInterest({ accountNo }: { accountNo: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<AccountInterest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AccountInterest>(`/api/interest/accounts/${encodeURIComponent(accountNo)}`, {
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
          <Icon name="barChart" className="size-5 text-brand" /> Month-End Interest
        </h2>
        {data && (
          <p className="text-xs text-slate-500">
            {data.interestRate}% per month on the month-end balance · credited on the 1st · total{" "}
            <b className="text-emerald-700">{money(data.totalInterest)}</b>
          </p>
        )}
      </div>

      {error ? (
        <div className="p-5 sm:p-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : !data ? (
        <div className="m-5 h-24 animate-pulse rounded-lg bg-slate-100 sm:m-6" />
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 text-right font-medium">Previous Balance</th>
                <th className="px-4 py-3 text-right font-medium">Deposits</th>
                <th className="px-4 py-3 text-right font-medium">Withdrawals</th>
                <th className="px-4 py-3 text-right font-medium">Interest</th>
                <th className="px-4 py-3 text-right font-medium">Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-amber-50/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{monthLabel(data.currentMonth.month)}</p>
                  <p className="text-[11px] text-amber-700">Running · credited at month end</p>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {money(
                    String(
                      Number(data.currentMonth.balance) -
                        Number(data.currentMonth.deposits) +
                        Number(data.currentMonth.withdrawals),
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-right text-emerald-700">+{money(data.currentMonth.deposits)}</td>
                <td className="px-4 py-3 text-right text-red-600">
                  {Number(data.currentMonth.withdrawals) > 0 ? `−${money(data.currentMonth.withdrawals)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-600" title="If nothing else changes this month">
                  ≈ {money(data.currentMonth.estimatedInterest)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-navy">{money(data.currentMonth.balance)}</td>
              </tr>
              {data.months.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{monthLabel(m.month)}</p>
                    {m.receiptNo && <p className="font-mono text-[11px] text-slate-400">{m.receiptNo}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{money(m.previousBalance)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">+{money(m.deposits)}</td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {Number(m.withdrawals) > 0 ? `−${money(m.withdrawals)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700" title={`${m.rate}% of ${money(m.interestBase)}`}>
                    +{money(m.interest)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-navy">{money(m.closingBalance)}</td>
                </tr>
              ))}
              {data.months.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                    No month closed yet — the first interest is credited on the 1st of next month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
