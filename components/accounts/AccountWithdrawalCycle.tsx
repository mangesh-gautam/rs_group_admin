"use client";

import { SkeletonRegion, TableSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { money } from "@/lib/deposits/types";
import type { AccountCycleStatus, DepositMonthStatus } from "@/lib/withdrawals/types";

const MONTH_STYLE: Record<DepositMonthStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MISSED: "bg-red-50 text-red-700 ring-red-200",
  PENDING: "bg-slate-50 text-slate-500 ring-slate-200",
  GRACE: "bg-amber-50 text-amber-800 ring-amber-200",
};
const MONTH_LABEL: Record<DepositMonthStatus, string> = { PAID: "Paid", MISSED: "Missed — fine", PENDING: "Not due yet", GRACE: "In buffer" };

const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/**
 * Account page → deposit cycle and withdrawal eligibility (withdrawal-service):
 * cycle dates, every month PAID / MISSED / PENDING, missed-month penalty,
 * paid / outstanding, and whether a normal withdrawal is possible today.
 * A cycle starts with a deposit and ends with a withdrawal or the closure;
 * in between nothing is expected and no penalty arises. The backend computes
 * all of it; this only displays it.
 */
export function AccountWithdrawalCycle({ accountNo }: { accountNo: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<AccountCycleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AccountCycleStatus>(`/api/withdrawals/accounts/${encodeURIComponent(accountNo)}/cycle`, {
      signal: controller.signal,
    }).then(setData, (err) => {
      if ((err as Error).name !== "AbortError") setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [authFetch, accountNo]);

  const c = data?.cycle;
  const eligible = c?.normalEligible ?? false;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="calendar" className="size-5 text-brand" /> Deposit Cycle &amp; Withdrawal Eligibility
        </h2>
        {c && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              eligible
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            {eligible ? "Eligible for normal withdrawal" : "Not Eligible"}
          </span>
        )}
      </div>

      {error ? (
        <div className="p-5 sm:p-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : !data ? (
        <SkeletonRegion label="Loading account statement…" className="p-5 sm:p-6"><TableSkeleton rows={4} columns={5} /></SkeletonRegion>
      ) : !c ? (
        <p className="p-5 text-sm text-slate-500 sm:p-6">
          {data.cycleState === "CLOSED"
            ? `The account is closed${data.closedOn ? ` (since ${formatDate(data.closedOn)})` : ""} — no deposit cycle, no penalty. A deposit resumes it and starts a new ${data.rules.minDurationMonths}-month cycle.`
            : data.cycleState === "INACTIVE"
              ? `No active deposit cycle — the last cycle ended with the withdrawal${data.lastWithdrawalOn ? ` on ${formatDate(data.lastWithdrawalOn)}` : ""}. No deposit is due and no penalty applies until the holder deposits again; that deposit starts a new ${data.rules.minDurationMonths}-month cycle.`
              : "No successful deposit yet — the cycle starts with the first deposit."}
        </p>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Deposit Cycle" value={`${formatDate(c.startOn)} – ${formatDate(c.endOn)}`} wide />
            <Stat
              label="Cycle Starts From"
              value={c.startsFrom === "FIRST_DEPOSIT" ? "First deposit" : c.startsFrom === "DEPOSIT_AFTER_CLOSURE" ? "Deposit that resumed the account" : "Deposit after withdrawal"}
            />
            <Stat label="Required Duration" value={`${c.durationMonths} Months`} />
            <Stat label="Next Withdrawal Date" value={formatDate(c.eligibleOn)} />
            <Stat label="Completed Deposit Months" value={`${c.completedMonths}/${c.durationMonths}`} />
            <Stat label="Missed Months" value={String(c.missedMonths)} tone={c.missedMonths ? "bad" : undefined} />
            <Stat label="Penalty per Missed Month" value={money(c.penaltyPerMonth)} />
            <Stat label="Penalty" value={money(c.totalPenalty)} />
            <Stat label="Penalty Paid" value={money(c.penaltyPaid)} />
            <Stat
              label="Outstanding Penalty"
              value={money(c.outstandingPenalty)}
              tone={Number(c.outstandingPenalty) > 0 ? "bad" : undefined}
            />
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">
              Monthly deposits in this cycle — each month is due one month after the previous one; a fine applies only
              after the due date and the buffer days have both passed
            </p>
            <ul className="flex flex-wrap gap-2">
              {c.months.map((m) => (
                <li
                  key={m.month}
                  className={`rounded-lg px-3 py-1.5 text-xs ring-1 ${MONTH_STYLE[m.status]}`}
                  title={`Month ${m.monthNo}: due ${formatDate(m.dueOn)}${m.monthNo > 1 ? `, pay by ${formatDate(m.payBy)}` : ""}${m.depositCount ? ` · ${m.depositCount} deposit(s), ${money(m.depositTotal)}` : ""}`}
                >
                  <span className="font-medium">{m.monthNo === 1 ? `Start ${dayMonth(m.dueOn)}` : `Due ${dayMonth(m.dueOn)}`}</span>
                  {m.monthNo > 1 && m.status !== "PAID" && <span className="text-[11px]"> (pay by {dayMonth(m.payBy)})</span>} · {MONTH_LABEL[m.status]}
                </li>
              ))}
            </ul>
          </div>

          {eligible ? (
            <Alert tone="success">
              <b>Withdrawal Status: Eligible</b> — a normal withdrawal (no deduction) can be made today.
            </Alert>
          ) : (
            <Alert tone="warning">
              <b>Withdrawal Status: Not Eligible</b> for a normal withdrawal.
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {c.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {data.withdrawalToday.allowed ? (
                <p className="mt-1">
                  A withdrawal today would be early: {Number(data.withdrawalToday.penaltyRate)}% of the amount is deducted.
                </p>
              ) : (
                <p className="mt-1">
                  No withdrawal is possible until the penalty is paid —{" "}
                  <Link href={`/admin/withdrawals?accountNo=${accountNo}`} className="font-medium underline">
                    collect it at the withdrawal desk
                  </Link>
                  .
                </p>
              )}
            </Alert>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, wide, tone }: { label: string; value: string; wide?: boolean; tone?: "bad" }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-semibold ${tone === "bad" ? "text-red-600" : "text-navy"}`}>{value}</dd>
    </div>
  );
}
