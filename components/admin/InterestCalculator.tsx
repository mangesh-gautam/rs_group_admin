"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { money } from "@/lib/deposits/types";

/** Durations offered as one-tap choices (months). */
const PRESETS = [
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
  { months: 24, label: "2 years" },
  { months: 36, label: "3 years" },
  { months: 60, label: "5 years" },
  { months: 120, label: "10 years" },
];
const MIN_MONTHS = 6;
const MAX_MONTHS = 120;

type MonthRow = { month: number; principal: number; interest: number; totalInterest: number; total: number };

/**
 * The society's rule, worked out in the browser (nothing is saved): the
 * holder deposits the same amount every month; at each month end the
 * principal deposited so far earns `rate` % (simple interest — credited
 * interest never earns interest). After 6 months or more a withdrawal is
 * NORMAL, so the holder receives principal + interest in full.
 *
 *   month k: principal = k × deposit, interest = round(principal × rate / 100, 2)
 */
export function calculateMaturity(deposit: number, months: number, rate: number): MonthRow[] {
  const rows: MonthRow[] = [];
  let totalInterest = 0;
  for (let k = 1; k <= months; k++) {
    const principal = round2(deposit * k);
    const interest = round2((principal * rate) / 100);
    totalInterest = round2(totalInterest + interest);
    rows.push({ month: k, principal, interest, totalInterest, total: round2(principal + totalInterest) });
  }
  return rows;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const inr = (n: number) => money(n.toFixed(2));
const durationLabel = (m: number) => {
  const y = Math.floor(m / 12), r = m % 12;
  return [y && `${y} year${y > 1 ? "s" : ""}`, r && `${r} month${r > 1 ? "s" : ""}`].filter(Boolean).join(" ");
};

/** Dashboard → "what will a monthly saver get back?" calculator (frontend only). */
export function InterestCalculator({ defaultRate = 0.75 }: { defaultRate?: number }) {
  const [depositText, setDepositText] = useState("1000");
  const [months, setMonths] = useState(12);
  const [rateText, setRateText] = useState(String(defaultRate));
  const [showAll, setShowAll] = useState(false);

  const deposit = Number(depositText.replace(/,/g, ""));
  const rate = Number(rateText);
  const depositError = !/^\d{1,8}(\.\d{1,2})?$/.test(depositText.replace(/,/g, "")) || deposit <= 0
    ? "Enter a monthly amount greater than 0" : null;
  const rateError = !/^\d{1,2}(\.\d{1,2})?$/.test(rateText) || rate > 10 ? "Enter a rate from 0 to 10 % a month" : null;

  const rows = useMemo(
    () => (depositError || rateError ? [] : calculateMaturity(deposit, months, rate)),
    [deposit, months, rate, depositError, rateError],
  );
  const last = rows.at(-1);
  const interestShare = last && last.total > 0 ? (last.totalInterest / last.total) * 100 : 0;
  const milestones = new Set([6, ...Array.from({ length: MAX_MONTHS / 12 }, (_, i) => (i + 1) * 12), months]);
  const tableRows = showAll ? rows : rows.filter((r) => milestones.has(r.month));

  return (
    <section className="calc-pop rounded-xl border border-slate-200 bg-white" aria-labelledby="calc-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 id="calc-title" className="flex items-center gap-2 font-semibold text-navy">
            <Icon name="barChart" className="size-4 text-brand" /> Monthly Deposit Calculator
          </h3>
          <p className="text-xs text-slate-500">
            What a member gets back on withdrawal: same deposit every month, interest on the principal only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ---- inputs ---- */}
        <div className="space-y-4">
          <div>
            <label htmlFor="calc-deposit" className="text-xs font-medium text-slate-700">Monthly deposit</label>
            <div className={`mt-1 flex items-center rounded-lg border bg-white px-3 focus-within:ring-2 focus-within:ring-brand/30 ${depositError ? "border-red-300" : "border-slate-200"}`}>
              <span className="text-sm text-slate-500">₹</span>
              <input id="calc-deposit" inputMode="decimal" value={depositText}
                onChange={(e) => setDepositText(e.target.value.replace(/[^\d.,]/g, ""))}
                aria-invalid={!!depositError} aria-describedby={depositError ? "calc-deposit-err" : undefined}
                className="w-full bg-transparent px-2 py-2 text-sm font-semibold text-navy outline-none tabular-nums" />
            </div>
            {depositError && <p id="calc-deposit-err" className="mt-1 text-xs text-red-600">{depositError}</p>}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="calc-months" className="text-xs font-medium text-slate-700">Duration</label>
              <span className="text-sm font-semibold text-navy">{durationLabel(months)}</span>
            </div>
            <input id="calc-months" type="range" min={MIN_MONTHS} max={MAX_MONTHS} step={1} value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-brand)]" aria-valuetext={durationLabel(months)} />
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick durations">
              {PRESETS.map((p) => (
                <button key={p.months} type="button" onClick={() => setMonths(p.months)} aria-pressed={months === p.months}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    months === p.months ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:border-brand hover:text-brand"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="calc-rate" className="text-xs font-medium text-slate-700">Interest rate (% per month)</label>
            <div className={`mt-1 flex items-center rounded-lg border bg-white px-3 focus-within:ring-2 focus-within:ring-brand/30 ${rateError ? "border-red-300" : "border-slate-200"}`}>
              <input id="calc-rate" inputMode="decimal" value={rateText}
                onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, ""))}
                aria-invalid={!!rateError} aria-describedby={rateError ? "calc-rate-err" : "calc-rate-hint"}
                className="w-full bg-transparent py-2 text-sm font-semibold text-navy outline-none tabular-nums" />
              <span className="text-sm text-slate-500">%</span>
            </div>
            {rateError
              ? <p id="calc-rate-err" className="mt-1 text-xs text-red-600">{rateError}</p>
              : <p id="calc-rate-hint" className="mt-1 text-[11px] text-slate-500">Society rate is {defaultRate}% a month ({(defaultRate * 12).toFixed(2)}% a year, simple).</p>}
          </div>
        </div>

        {/* ---- result ---- */}
        <div className="min-w-0 space-y-3" aria-live="polite">
          {last ? <>
            <div className="rounded-xl bg-navy p-4 text-white">
              <p className="text-xs text-slate-300">Amount on withdrawal after {durationLabel(months)}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{inr(last.total)}</p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <span className="bg-sky-300" style={{ width: `${100 - interestShare}%` }} />
                <span className="bg-emerald-400" style={{ width: `${interestShare}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="flex items-center gap-1.5 text-[11px] text-slate-300"><i className="size-2 rounded-full bg-sky-300" />Principal deposited</dt>
                  <dd className="font-semibold tabular-nums">{inr(last.principal)}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-[11px] text-slate-300"><i className="size-2 rounded-full bg-emerald-400" />Interest earned (profit)</dt>
                  <dd className="font-semibold tabular-nums text-emerald-300">+{inr(last.totalInterest)}</dd></div>
              </dl>
              <p className="mt-3 text-[11px] text-slate-300">
                {months} deposits of {inr(deposit)} · profit {(last.principal > 0 ? (last.totalInterest / last.principal) * 100 : 0).toFixed(2)}% on the principal · normal withdrawal, no deduction
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs sm:min-w-[440px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Principal</th>
                    <th className="px-3 py-2 text-right font-medium">Interest (month)</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Interest (total)</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {tableRows.map((r) => (
                    <tr key={r.month} className={r.month === months ? "bg-brand-soft/60 font-semibold text-navy" : "text-slate-700"}>
                      <td className="px-3 py-1.5">{r.month}</td>
                      <td className="hidden px-3 py-1.5 text-right sm:table-cell">{inr(r.principal)}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-700">+{inr(r.interest)}</td>
                      <td className="hidden px-3 py-1.5 text-right sm:table-cell">{inr(r.totalInterest)}</td>
                      <td className="px-3 py-1.5 text-right">{inr(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-brand hover:underline">
              {showAll ? "Show key months only" : `Show all ${months} months`}
            </button>
          </> : (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Fix the highlighted field to see the result.
            </p>
          )}
        </div>
      </div>
      <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
        Assumes every monthly deposit is made on time and interest is credited at each month end, as the app does. Withdrawing before 6 months is an early withdrawal and loses part of the amount; missed months add a penalty.
      </p>
    </section>
  );
}
