"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Field, Spinner, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ModalForm } from "@/components/ui/ModalForm";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { money } from "@/lib/deposits/types";
import {
  COMMISSION_STATUS,
  PAYOUT_LABEL,
  currentMonth,
  levelLabel,
  monthLabel,
  rateLabel,
  type CommissionMonthRow,
  type CommissionPayout,
  type CommissionPayoutPage,
  type CommissionSources,
  type CommissionStatement,
  type EarnedPage,
  type PayoutType,
} from "@/lib/referral/types";

type Tab = "sources" | "history" | "months" | "payouts";
const TABS: { id: Tab; label: string; icon: "users" | "fileText" | "calendar" | "wallet" }[] = [
  { id: "sources", label: "Earned from", icon: "users" },
  { id: "history", label: "Commission history", icon: "fileText" },
  { id: "months", label: "Monthly statement", icon: "calendar" },
  { id: "payouts", label: "Payouts", icon: "wallet" },
];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The advisor's own page (/…/advisor-commission/[accountNo]): back to the
 * list, the detail below, and the cash Pay / Withdraw dialog.
 */
export function AdvisorCommissionPage({ accountNo, month, listPath, advisorsPath }: {
  accountNo: string;
  month: string | null;
  listPath: string;
  advisorsPath: string;
}) {
  const [payout, setPayout] = useState<{ row: Pick<CommissionMonthRow, "advisor" | "available">; type: PayoutType } | null>(null);
  const [receipt, setReceipt] = useState<CommissionPayout | null>(null);
  const [version, setVersion] = useState(0); // bumped after a payout → the detail reloads
  const backHref = month ? `${listPath}?month=${month}` : listPath;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand">
        <Icon name="chevronRight" className="size-4 rotate-180" /> All advisors
      </Link>
      {receipt && (
        <Alert tone="success">
          <span className="font-medium">{PAYOUT_LABEL[receipt.type]} of {money(receipt.amount)}</span> — receipt{" "}
          <span className="font-mono">{receipt.receiptNo}</span>. Commission balance now {money(receipt.balanceAfter ?? "0")}.
        </Alert>
      )}
      <AdvisorCommissionDetail key={version} accountNo={accountNo.toUpperCase()} month={month ?? currentMonth()} advisorsPath={advisorsPath}
        backHref={backHref} onPay={(row, type) => setPayout({ row, type })} />
      {payout && (
        <PayoutDialog advisor={payout.row.advisor} available={payout.row.available} initialType={payout.type}
          onDone={(r) => { setPayout(null); setReceipt(r); setVersion((v) => v + 1); }} onCancel={() => setPayout(null)} />
      )}
    </div>
  );
}

/**
 * One advisor's commission, start to finish:
 *   member deposits → commission earned (Earned from / Commission history)
 *   → balance month by month (Monthly statement) → paid out in cash (Payouts).
 * Selecting a member shows every deposit of theirs that paid this advisor.
 */
export function AdvisorCommissionDetail({
  accountNo,
  month,
  advisorsPath,
  backHref,
  onPay,
}: {
  accountNo: string;
  month: string; // the month chosen on the list, offered as a filter
  advisorsPath: string;
  backHref: string;
  onPay: (row: Pick<CommissionMonthRow, "advisor" | "available">, type: PayoutType) => void;
}) {
  const { authFetch, user } = useAuth();
  const [data, setData] = useState<CommissionStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjusted, setAdjusted] = useState<string | null>(null);
  const [controlling, setControlling] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("sources");
  const [scope, setScope] = useState<string | null>(null); // null = all months, else "YYYY-MM"
  const [member, setMember] = useState<{ accountNo: string; name: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<CommissionStatement>(`/api/deposits/advisor-commissions/${encodeURIComponent(accountNo)}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  // net of reversals and Super Admin adjustments, so earned − paid = balance
  const earnedTotal = data?.months.reduce((s, m) => s + Number(m.earned) + Number(m.reversed) + Number(m.adjusted), 0) ?? 0;
  const paidTotal = data?.months.reduce((s, m) => s + Number(m.paid), 0) ?? 0;
  const openMember = (m: { accountNo: string; name: string }) => { setMember(m); setTab("sources"); };
  const openMonth = (m: string) => { setScope(m); setMember(null); setTab("history"); };

  return (
    <section className="@container/panel overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* ---- who + balance ---- */}
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-brand uppercase">Advisor</p>
            <h1 className="text-xl font-bold text-navy">{data?.advisor.name ?? accountNo}</h1>
            <p className="font-mono text-xs text-slate-500">
              {accountNo}{data && ` · ${data.advisor.office.name}${data.advisor.office.city ? `, ${data.advisor.office.city}` : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${advisorsPath}?advisor=${accountNo}`} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50">
              <Icon name="users" className="size-4" /> Referrals
            </Link>
            <Link href={backHref} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Icon name="x" className="size-4" /> Close
            </Link>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}
        {adjusted && <Alert tone="success">{adjusted}</Alert>}
        {data && (
          <CommissionStateBar control={data.commission} canChange={user?.role === "SUPER_ADMIN"}
            onChange={() => { setControlling(true); setAdjusted(null); }} />
        )}
        {!data && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}

        {data && (
          <div className="grid grid-cols-1 gap-3 @2xl/panel:grid-cols-[1fr_auto]">
            {/* earned − paid = balance: three labelled rows when narrow, one equation line when wide */}
            <dl className="grid grid-cols-1 gap-1.5 rounded-xl bg-slate-50 p-3 @md/panel:grid-cols-3 @md/panel:items-center @md/panel:gap-1 @md/panel:text-center">
              <div className="flex items-baseline justify-between gap-3 @md/panel:block">
                <dt className="text-[11px] text-slate-500">Total earned (net)</dt>
                <dd className="text-base font-bold text-emerald-700 tabular-nums @lg/panel:text-lg">{money(String(earnedTotal))}</dd>
              </div>
              <div className="relative flex items-baseline justify-between gap-3 @md/panel:block">
                <span className="absolute top-1/2 -left-1 hidden -translate-y-1/2 text-slate-400 @md/panel:inline">−</span>
                <dt className="text-[11px] text-slate-500"><span className="@md/panel:hidden">− </span>Paid out</dt>
                <dd className="text-base font-bold text-red-700 tabular-nums @lg/panel:text-lg">{money(String(paidTotal))}</dd>
              </div>
              <div className="relative flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1.5 @md/panel:block @md/panel:border-0 @md/panel:pt-0">
                <span className="absolute top-1/2 -left-1 hidden -translate-y-1/2 text-slate-400 @md/panel:inline">=</span>
                <dt className="text-[11px] font-medium text-slate-600"><span className="@md/panel:hidden">= </span>Balance</dt>
                <dd className="text-base font-bold text-navy tabular-nums @lg/panel:text-lg">{money(data.available)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PayButtons row={data} onPay={(type) => onPay(data, type)} />
              {user?.role === "SUPER_ADMIN" && (
                <button type="button" onClick={() => { setAdjusting(true); setAdjusted(null); }}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50">
                  <Icon name="settings" className="size-4" /> Adjust wallet
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          {/* ---- tabs + period ---- */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-5">
            <div className="-mx-1 flex overflow-x-auto" role="tablist" aria-label="Commission views">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  onClick={() => { setTab(t.id); if (t.id !== "sources") setMember(null); }}
                  className={`flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-navy"}`}>
                  <Icon name={t.icon} className="size-4" /> {t.label}
                </button>
              ))}
            </div>
            {(tab === "sources" || tab === "history") && (
              <div className="flex gap-1.5 text-xs" role="group" aria-label="Period">
                {[null, month].map((m) => (
                  <button key={m ?? "all"} type="button" onClick={() => setScope(m)} aria-pressed={scope === m}
                    className={`rounded-full border px-3 py-1 font-medium ${scope === m ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600"}`}>
                    {m ? monthLabel(m) : "All time"}
                  </button>
                ))}
                {scope && scope !== month && (
                  <span className="rounded-full border border-brand bg-brand-soft px-3 py-1 font-medium text-brand">{monthLabel(scope)}</span>
                )}
              </div>
            )}
          </div>

          <div className="p-3 sm:p-5">
            {tab === "sources" && (member
              ? <MemberHistory advisorNo={accountNo} member={member} month={scope} onBack={() => setMember(null)} />
              : <Sources advisorNo={accountNo} month={scope} onOpen={openMember} />)}
            {tab === "history" && <EarnedHistory advisorNo={accountNo} month={scope} onMember={openMember} />}
            {tab === "months" && <MonthlyStatement data={data} onMonth={openMonth} />}
            {tab === "payouts" && <PayoutHistory key={version} accountNo={accountNo} embedded />}
          </div>
        </>
      )}

      {controlling && data && (
        <CommissionControlDialog advisor={data.advisor} active={data.commission.active}
          onCancel={() => setControlling(false)}
          onDone={(msg) => { setControlling(false); setAdjusted(msg); setVersion((v) => v + 1); }} />
      )}
      {adjusting && data && (
        <AdjustDialog advisor={data.advisor} available={data.available}
          onCancel={() => setAdjusting(false)}
          onDone={(msg) => { setAdjusting(false); setAdjusted(msg); setVersion((v) => v + 1); }} />
      )}
    </section>
  );
}

/* ---- commission on / off (Super Admin may change it) ------------------------------ */
function CommissionStateBar({ control, canChange, onChange }: { control: CommissionStatement["commission"]; canChange: boolean; onChange: () => void }) {
  const since = control.changedAt ? `${control.active ? "Resumed" : "Stopped"} ${formatDateTime(control.changedAt)}${control.changedBy ? ` by ${control.changedBy}` : ""}` : null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${control.active ? "border-emerald-200 bg-emerald-50/60" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${control.active ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
        <div className="min-w-0">
          <p className={`font-semibold ${control.active ? "text-emerald-800" : "text-amber-900"}`}>
            {control.active ? "Commission active" : "Commission stopped"}
          </p>
          <p className="text-xs text-slate-600">
            {control.active
              ? "Earns commission on every deposit of the members they referred, by the current rules."
              : "New deposits of their referred members earn this advisor nothing. Commission already earned stays in the wallet and can still be paid."}
          </p>
          {(since || control.reason) && (
            <p className="mt-0.5 text-[11px] text-slate-500">{since}{control.reason ? ` · “${control.reason}”` : ""}</p>
          )}
        </div>
      </div>
      {canChange && (
        <button type="button" onClick={onChange}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${control.active ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
          <Icon name={control.active ? "x" : "refresh"} className="size-4" /> {control.active ? "Stop commission" : "Resume commission"}
        </button>
      )}
    </div>
  );
}

/* ---- Super Admin: stop / resume new commission ----------------------------------- */
function CommissionControlDialog({ advisor, active, onDone, onCancel }: {
  advisor: CommissionStatement["advisor"];
  active: boolean; // true → this dialog stops it
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await authFetch(`/api/deposits/advisor-commissions/${encodeURIComponent(advisor.accountNo)}/${active ? "stop" : "resume"}`, {
        method: "POST", body: { reason: reason.trim() || undefined },
      });
      onDone(active
        ? `Commission stopped for ${advisor.name}. Their earned balance is unchanged.`
        : `Commission resumed for ${advisor.name}. New deposits earn commission again.`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalForm title={active ? "Stop commission" : "Resume commission"} subtitle={`${advisor.accountNo} — ${advisor.name}`}
      icon={active ? "x" : "refresh"} danger={active} saving={saving}
      submitLabel={active ? "Stop commission" : "Resume commission"} onSubmit={submit} onCancel={onCancel}>
      <ul className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        {active ? (
          <>
            <li>✗ From now on, deposits of the members this advisor referred <b>earn them no commission</b>.</li>
            <li>✓ Commission already earned, the wallet balance and every payment stay <b>exactly as they are</b> — you can still pay it.</li>
            <li>✓ Other advisors in the chain keep earning as usual. You can resume at any time.</li>
          </>
        ) : (
          <>
            <li>✓ New deposits earn this advisor commission again, by the <b>current</b> commission rules.</li>
            <li>• Deposits made while it was stopped are <b>not</b> paid later.</li>
          </>
        )}
      </ul>
      <Field label="Reason (optional)" htmlFor="ctl-reason">
        <input id="ctl-reason" value={reason} maxLength={200} disabled={saving} onChange={(e) => setReason(e.target.value)}
          className={inputCls()} placeholder={active ? "e.g. Under review" : "e.g. Review completed"} />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
    </ModalForm>
  );
}

/* ---- Super Admin: ± adjustment of the commission wallet ------------------------- */
function AdjustDialog({ advisor, available, onDone, onCancel }: {
  advisor: CommissionStatement["advisor"];
  available: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const value = Number(amount.replace(/,/g, ""));
  const signed = direction === "CREDIT" ? value : -value;
  const after = Number(available) + (Number.isFinite(signed) ? signed : 0);

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount.replace(/,/g, "")) || value <= 0) found.amount = "Enter an amount greater than 0 (max 2 decimals)";
    else if (after < 0) found.amount = `At most ${money(available)} can be taken off`;
    if (reason.trim().length < 3) found.reason = "Give the reason (at least 3 characters)";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch<{ balanceAfter: string }>(`/api/deposits/advisor-commissions/${encodeURIComponent(advisor.accountNo)}/adjustments`, {
        method: "POST", body: { amount: signed.toFixed(2), reason: reason.trim(), requestKey },
      });
      onDone(`Wallet ${direction === "CREDIT" ? "credited" : "debited"} ${money(value.toFixed(2))}. Commission balance now ${money(r.balanceAfter)}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalForm title="Adjust commission wallet" subtitle={`${advisor.accountNo} — ${advisor.name}`} icon="settings"
      saving={saving} submitLabel={direction === "CREDIT" ? "Credit wallet" : "Debit wallet"} onSubmit={submit} onCancel={onCancel}>
      <p className="text-sm text-slate-600">
        For corrections only — e.g. a commission that was missed, or one credited by mistake. It is kept in the history with your
        name and the reason, and it never touches the advisor&apos;s savings.
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label="Direction">
        {(["CREDIT", "DEBIT"] as const).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} disabled={saving} onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${direction === d ? (d === "CREDIT" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-red-400 bg-red-50 text-red-800") : "border-slate-200 text-slate-600"}`}>
            {d === "CREDIT" ? "+ Add to wallet" : "− Take off wallet"}
          </button>
        ))}
      </div>
      <Field label="Amount (₹)" required htmlFor="adj-amount" error={errors.amount}
        hint={value > 0 ? `Balance ${money(available)} → ${money(after.toFixed(2))}` : `Balance now ${money(available)}`}>
        <input id="adj-amount" inputMode="decimal" value={amount} disabled={saving} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          className={inputCls(errors.amount)} placeholder="0.00" />
      </Field>
      <Field label="Reason" required htmlFor="adj-reason" error={errors.reason}>
        <input id="adj-reason" value={reason} maxLength={200} disabled={saving} onChange={(e) => setReason(e.target.value)}
          className={inputCls(errors.reason)} placeholder="e.g. Commission missed on DEP00000123" />
      </Field>
      {error && !Object.keys(errors).length && <Alert tone="error">{error}</Alert>}
    </ModalForm>
  );
}

/* ---- Earned from: one row per member account ---------------------------------- */

function Sources({ advisorNo, month, onOpen }: { advisorNo: string; month: string | null; onOpen: (m: { accountNo: string; name: string }) => void }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<CommissionSources | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const q = month ? `?month=${month}` : "";
    authFetch<CommissionSources>(`/api/deposits/advisor-commissions/${encodeURIComponent(advisorNo)}/sources${q}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, advisorNo, month]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  if (!data.items.length) {
    return <Empty>{month ? `No commission earned in ${monthLabel(month)}.` : "No commission earned yet — it starts with the first deposit of a member this advisor referred."}</Empty>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        <b className="text-navy">{money(data.totalAmount)}</b> earned{month ? ` in ${monthLabel(month)}` : ""} from the deposits of{" "}
        <b className="text-navy">{data.items.length}</b> member account{data.items.length > 1 ? "s" : ""}. Select one to see every deposit.
      </p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {data.items.map((s) => (
          <li key={s.member.accountNo}>
            <button type="button" onClick={() => onOpen(s.member)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50">
              <LevelBadge level={s.level} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-navy">{s.member.name}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  <span className="font-mono">{s.member.accountNo}</span>
                  {s.level > 1 && s.via && <> · via {s.via.name}</>}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {s.entries} deposit{s.entries > 1 ? "s" : ""} of {money(s.depositTotal)} · last {day(s.lastAt)}
                  {s.reversals > 0 && <span className="text-amber-700"> · {s.reversals} reversed</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold text-emerald-700 tabular-nums">+{money(s.commissionTotal)}</span>
                <span className="block text-[10px] text-slate-400 uppercase">commission</span>
              </span>
              <Icon name="chevronRight" className="size-4 shrink-0 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- one member: every deposit → commission ----------------------------------------- */

function MemberHistory({ advisorNo, member, month, onBack }: {
  advisorNo: string; member: { accountNo: string; name: string }; month: string | null; onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <Icon name="chevronRight" className="size-3.5 rotate-180" /> All members
        </button>
        <p className="text-sm text-slate-700">
          Deposits of <Link href={`/admin/accounts/${member.accountNo}`} className="font-semibold text-navy hover:text-brand hover:underline">{member.name}</Link>{" "}
          <span className="font-mono text-xs text-slate-500">{member.accountNo}</span> that paid this advisor
        </p>
      </div>
      <EarnedHistory advisorNo={advisorNo} month={month} source={member.accountNo} />
    </div>
  );
}

/* ---- Commission history: deposit → commission, newest first -------------------------- */

function EarnedHistory({ advisorNo, month, source, onMember }: {
  advisorNo: string; month: string | null; source?: string; onMember?: (m: { accountNo: string; name: string }) => void;
}) {
  const { authFetch } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EarnedPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState(`${month}|${source}`);
  if (filterKey !== `${month}|${source}`) { setFilterKey(`${month}|${source}`); setPage(1); } // new filter → first page

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (month) params.set("month", month);
    if (source) params.set("source", source);
    authFetch<EarnedPage>(`/api/deposits/advisor-commissions/${encodeURIComponent(advisorNo)}/earned?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, advisorNo, month, source, page]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  if (!data.items.length) return <Empty>{month ? `No commission in ${monthLabel(month)}.` : "No commission earned yet."}</Empty>;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        {data.total} deposit{data.total > 1 ? "s" : ""} of {money(data.totalDeposits)} → <b className="text-emerald-700">{money(data.totalAmount)}</b> commission
        {month ? ` in ${monthLabel(month)}` : ""}
      </p>
      {/* narrow: cards */}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 @2xl/panel:hidden">
        {data.items.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                {!source && <MemberName e={e} onMember={onMember} />}
                <LevelBadge level={e.level} small />
              </p>
              <p className="text-[11px] text-slate-500">
                Deposited {money(e.deposit.amount)} ({e.deposit.mode}) · <span className="font-mono">{e.deposit.receiptNo}</span>
              </p>
              <p className="text-[11px] text-slate-400">{formatDateTime(e.at)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-semibold tabular-nums ${Number(e.amount) < 0 ? "text-amber-700" : "text-emerald-700"}`}>{Number(e.amount) < 0 ? "" : "+"}{money(e.amount)}</p>
              <p className="text-[11px] text-slate-500">{rateLabel(e.commissionType, e.rate)}{e.type === "REVERSAL" && " · reversed"}</p>
            </div>
          </li>
        ))}
      </ul>
      {/* wide: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 @2xl/panel:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              {!source && <th className="px-3 py-2 font-medium">Member</th>}
              <th className="hidden @lg/panel:table-cell px-3 py-2 font-medium">Level</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 font-medium">Deposit</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 text-right font-medium">Deposited</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((e) => (
              <tr key={e.id} className={e.type === "REVERSAL" ? "bg-amber-50/50" : ""}>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">
                  {formatDateTime(e.at)}
                  {/* narrow panel: the hidden columns in one line */}
                  <span className="block text-[11px] text-slate-500 @lg/panel:hidden">
                    L{e.level} · {money(e.deposit.amount)} deposit · {rateLabel(e.commissionType, e.rate)}
                  </span>
                </td>
                {!source && <td className="px-3 py-2"><MemberName e={e} onMember={onMember} /></td>}
                <td className="hidden @lg/panel:table-cell px-3 py-2"><LevelBadge level={e.level} small /></td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 font-mono text-xs text-slate-600">{e.deposit.receiptNo}<span className="ml-1 font-sans text-[11px] text-slate-400">{e.deposit.mode}</span></td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 text-right text-slate-700 tabular-nums">{money(e.deposit.amount)}</td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 text-right text-xs text-slate-600">{rateLabel(e.commissionType, e.rate)}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${Number(e.amount) < 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {Number(e.amount) < 0 ? "" : "+"}{money(e.amount)}
                  {e.type === "REVERSAL" && <span className="block text-[10px] font-normal">reversed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.pageSize && <Pager page={page} pages={pages} setPage={setPage} />}
    </div>
  );
}

function MemberName({ e, onMember }: { e: { member: { accountNo: string; name: string } }; onMember?: (m: { accountNo: string; name: string }) => void }) {
  return onMember ? (
    <button type="button" onClick={() => onMember(e.member)} className="text-left font-medium text-navy hover:text-brand hover:underline">
      {e.member.name}<span className="block font-mono text-[10px] font-normal text-slate-500">{e.member.accountNo}</span>
    </button>
  ) : <span className="font-medium text-navy">{e.member.name}</span>;
}

/* ---- Monthly statement ------------------------------------------------------------ */

function MonthlyStatement({ data, onMonth }: { data: CommissionStatement; onMonth: (m: string) => void }) {
  if (!data.months.length) return <Empty>No commission earned yet.</Empty>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Carried forward + earned − paid = outstanding; whatever is not paid carries into the next month automatically.
        Select a month to see where its commission came from.
      </p>
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm @lg/panel:min-w-[34rem]">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 text-right font-medium">Carried forward</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 text-right font-medium">Earned</th>
              <th className="hidden @lg/panel:table-cell px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Outstanding</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.months.map((m) => (
              <tr key={m.month} onClick={() => onMonth(m.month)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span className="font-medium text-brand underline-offset-2 hover:underline">{monthLabel(m.month)}</span>
                  <span className="block text-[11px] text-slate-500 tabular-nums @lg/panel:hidden">
                    <span className="text-emerald-700">+{money(m.earned)}</span> · <span className="text-red-700">−{money(m.paid)}</span>
                  </span>
                </td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 text-right text-slate-700 tabular-nums">{money(m.opening)}</td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 text-right text-emerald-700 tabular-nums">
                  +{money(m.earned)}
                  {m.earnedCount > 0 && <span className="block text-[10px] text-slate-400">{m.earnedCount} deposits</span>}
                  {Number(m.reversed) !== 0 && <span className="block text-[10px] text-red-600">reversed {money(m.reversed)}</span>}
                  {Number(m.adjusted) !== 0 && <span className="block text-[10px] text-blue-700">adjusted {money(m.adjusted)}</span>}
                </td>
                <td className="hidden @lg/panel:table-cell px-3 py-2 text-right text-red-700 tabular-nums">
                  −{money(m.paid)}
                  {m.payoutCount > 0 && <span className="block text-[10px] text-slate-400">{m.payoutCount} payout{m.payoutCount > 1 ? "s" : ""}</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-navy tabular-nums">{money(m.closing)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ${COMMISSION_STATUS[m.status].className}`}>
                    {COMMISSION_STATUS[m.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- small pieces ---------------------------------------------------------------- */

function LevelBadge({ level, small }: { level: number; small?: boolean }) {
  return (
    <span title={levelLabel(level)}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold ${level === 1 ? "bg-brand text-white" : "bg-brand-soft text-brand"} ${small ? "px-1.5 py-0.5 text-[10px]" : "size-9 text-xs"}`}>
      L{level}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (fn: (p: number) => number) => void }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-600">
      <span>Page {page} of {pages}</span>
      <span className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
      </span>
    </div>
  );
}

export function PayButtons({ row, onPay }: { row: Pick<CommissionMonthRow, "available">; onPay: (type: PayoutType) => void }) {
  const none = Number(row.available) <= 0;
  return (
    <span className="flex justify-end gap-1.5">
      <button type="button" disabled={none} onClick={() => onPay("PAYMENT")}
        className="flex h-8 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40">
        <Icon name="handCoins" className="size-3.5" /> Pay
      </button>
      <button type="button" disabled={none} onClick={() => onPay("WITHDRAWAL")}
        className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
        <Icon name="upload" className="size-3.5" /> Withdraw
      </button>
    </span>
  );
}


/* ---- payout history (one advisor, or one month across advisors) ----------------- */

export function PayoutHistory({ accountNo, month, embedded }: { accountNo?: string; month?: string; embedded?: boolean }) {
  const { authFetch } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CommissionPayoutPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (accountNo) params.set("accountNo", accountNo);
    if (month) params.set("month", month);
    authFetch<CommissionPayoutPage>(`/api/deposits/advisor-commissions/payouts?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, accountNo, month, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const title = accountNo ? "Payout history" : `Payouts in ${month ? monthLabel(month) : "all months"}`;

  return (
    <section className={embedded ? "" : "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {data && data.total > 0 && (
          <span className="text-xs text-slate-500">{data.total} entr{data.total > 1 ? "ies" : "y"} · paid out {money(data.totalAmount)}</span>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
      {data && data.items.length === 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No commission paid out yet.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {data.items.map((p) => (
            <li key={p.receiptNo} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    p.type === "PAYMENT" ? "bg-brand-soft text-brand" : p.type === "WITHDRAWAL" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}>
                    {p.type === "PAYMENT" ? "PAID" : p.type === "WITHDRAWAL" ? "WITHDRAWN" : "ADJUSTED"}
                  </span>
                  {!accountNo && <span className="font-medium text-navy">{p.advisor.name}</span>}
                  <span className="font-mono text-xs text-slate-500">{p.receiptNo}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatDateTime(p.paidAt)}{p.mode ? ` · ${p.mode}` : ""} · by {p.paidBy} · {monthLabel(p.month)}
                  {p.referenceNo && ` · ref ${p.referenceNo}`}
                </p>
                {p.remarks && <p className="text-[11px] text-slate-600">{p.remarks}</p>}
              </div>
              <div className="text-right">
                {p.type === "ADJUSTMENT" ? (
                  <p className={`font-semibold tabular-nums ${Number(p.amount) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {Number(p.amount) >= 0 ? "+" : "−"}{money(String(Math.abs(Number(p.amount))))}
                  </p>
                ) : (
                  <p className="font-semibold text-red-700 tabular-nums">−{money(p.amount)}</p>
                )}
                {p.balanceAfter !== null && <p className="text-[11px] text-slate-500 tabular-nums">balance {money(p.balanceAfter)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.pageSize && (
        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
          <span>Page {page} of {pages}</span>
          <span className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((x) => x - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((x) => x + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
          </span>
        </div>
      )}
    </section>
  );
}

/* ---- pay / withdraw dialog ---------------------------------------------------- */

export function PayoutDialog({
  advisor,
  available,
  initialType,
  onDone,
  onCancel,
}: {
  advisor: CommissionMonthRow["advisor"];
  available: string;
  initialType: PayoutType;
  onDone: (r: CommissionPayout) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [type, setType] = useState<PayoutType>(initialType);
  const [amount, setAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // one key per dialog: a double-click or a retry after a timeout pays only once (the server returns the first payout)
  const [requestKey] = useState(() => crypto.randomUUID());
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onCancel, saving]);

  const value = Number(amount.replace(/,/g, ""));
  const max = Number(available);
  const after = Number.isFinite(value) ? max - value : max;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors: Record<string, string> = {};
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount.replace(/,/g, "")) || value <= 0) fieldErrors.amount = "Enter an amount greater than 0 (max 2 decimals)";
    else if (value > max) fieldErrors.amount = `Only ${money(available)} commission is available`;
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch<CommissionPayout>(`/api/deposits/advisor-commissions/${encodeURIComponent(advisor.accountNo)}/payouts`, {
        method: "POST",
        body: { type, amount: value.toFixed(2), mode: "CASH", referenceNo: referenceNo.trim() || undefined, remarks: remarks.trim() || undefined, requestKey },
      });
      onDone(r);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="payout-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
      onClick={() => !saving && onCancel()}>
      <form onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="wallet" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="payout-title" className="font-semibold text-navy">Pay commission in cash</h2>
            <p className="truncate text-xs text-slate-600"><span className="font-mono">{advisor.accountNo}</span> — {advisor.name}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            <Icon name="x" className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1" role="radiogroup" aria-label="Payout type">
            {(["PAYMENT", "WITHDRAWAL"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                className={`h-9 rounded-md text-sm font-medium ${type === t ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {t === "PAYMENT" ? "Pay commission" : "Advisor withdrawal"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Commission balance</span>
            <span className="font-bold text-navy tabular-nums">{money(available)}</span>
          </div>

          <Field label="Amount (₹)" required htmlFor="payout-amount" error={errors.amount}
            hint={value > 0 && value <= max ? <>Balance after: <b className="text-navy">{money(String(after))}</b></> : undefined}>
            <div className="flex gap-2">
              <input id="payout-amount" ref={amountRef} inputMode="decimal" value={amount} disabled={saving}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className={inputCls(errors.amount)} placeholder="0.00" />
              <button type="button" disabled={saving} onClick={() => setAmount(max.toFixed(2))}
                className="h-11 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-brand hover:bg-brand-soft">Full</button>
            </div>
          </Field>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-navy">Mode:</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Cash</span>
          </div>

          <Field label="Reference / voucher no." optional htmlFor="payout-ref" error={errors.referenceNo}>
            <input id="payout-ref" value={referenceNo} maxLength={40} disabled={saving} onChange={(e) => setReferenceNo(e.target.value)} className={inputCls(errors.referenceNo)} />
          </Field>
          <Field label="Remarks" optional htmlFor="payout-remarks" error={errors.remarks}>
            <input id="payout-remarks" value={remarks} maxLength={200} disabled={saving} onChange={(e) => setRemarks(e.target.value)}
              className={inputCls(errors.remarks)} placeholder={type === "PAYMENT" ? "e.g. October commission" : "e.g. Advisor request"} />
          </Field>

          {error && !Object.keys(errors).length && <Alert tone="error">{error}</Alert>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onCancel} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={saving}
            className="flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {saving && <Spinner />} {type === "PAYMENT" ? "Pay" : "Withdraw"} {value > 0 ? money(value.toFixed(2)) : ""}
          </button>
        </div>
      </form>
    </div>
  );
}
