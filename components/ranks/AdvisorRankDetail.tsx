"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ModalForm } from "@/components/ui/ModalForm";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { day, rewardLabel, type RankSummary } from "@/lib/ranks/types";
import { ProgressBar, RankBadge, RewardBadge, RewardButtons, RewardDialog, type RewardAction } from "./RanksScreen";

type OpenedAccount = RankSummary["accounts"][number];

/**
 * One member's ranks: accounts opened under them, every rank with the accounts still needed,
 * their promotions and rewards, and each opened account — an Admin can exclude an invalid one
 * (with a reason) or count it again.
 */
export function AdvisorRankDetail({ accountNo, listPath, accountsPath }: { accountNo: string; listPath: string; accountsPath: string }) {
  const { authFetch, user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [data, setData] = useState<RankSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const [credit, setCredit] = useState<OpenedAccount | null>(null);
  const [reward, setReward] = useState<{ promotion: RankSummary["promotions"][number]; action: RewardAction } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<RankSummary>(`/api/customers/ranks/advisors/${encodeURIComponent(accountNo)}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  const changed = (msg: string) => { setDone(msg); setVersion((v) => v + 1); };
  const include = async (a: OpenedAccount) => {
    setError(null);
    try {
      const r = await authFetch<{ accountsOpened: number; promoted: number }>(`/api/customers/ranks/credits/${encodeURIComponent(a.accountNo)}`,
        { method: "POST", body: { counted: true } });
      changed(`${a.accountNo} counts again — ${r.accountsOpened} accounts${r.promoted ? `, promoted to a new rank` : ""}.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const advisor = data?.advisor;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href={listPath} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand">
        <Icon name="chevronRight" className="size-4 rotate-180" /> Ranks &amp; Rewards
      </Link>

      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      {!data && !error && <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />}

      {data && advisor && (
        <>
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-navy">{advisor.name}</h1>
              <Link href={`${accountsPath}/${advisor.accountNo}`} className="font-mono text-xs text-slate-500 hover:text-brand hover:underline">{advisor.accountNo}</Link>
              <div className="mt-2"><RankBadge rank={data.currentRank} /></div>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Accounts opened" value={data.accountsOpened} />
              <Stat label="Excluded" value={data.excluded} />
              <Stat label={data.nextRank ? `For ${data.nextRank.name}` : "Next rank"} value={data.nextRank ? `${data.nextRank.remaining} more` : "—"} />
            </dl>
          </div>

          {/* every rank */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">Ranks</h2>
            <ul className="divide-y divide-slate-100">
              {data.ranks.map((r) => (
                <li key={r.code} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_14rem] sm:items-center">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">{r.name}</span>
                      <span className="text-xs text-slate-500">{r.target.toLocaleString("en-IN")} accounts</span>
                      {r.rewardStatus && <RewardBadge status={r.rewardStatus} />}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-600"><Icon name="gift" className="size-3 text-brand" /> {rewardLabel(r.reward)}</span>
                  </span>
                  <span>
                    <span className="flex justify-between text-[11px] text-slate-600">
                      <span>{r.achieved ? `Reached ${r.achievedAt ? day(r.achievedAt) : ""}` : `${Math.min(data.accountsOpened, r.target)} / ${r.target}`}</span>
                      <span className="font-medium text-navy">{r.achieved ? "100%" : `${r.remaining} more`}</span>
                    </span>
                    <ProgressBar value={r.progress} label={`${r.name}: ${r.progress}%`} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* promotions and rewards */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">Promotions &amp; rewards</h2>
            {data.promotions.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No rank reached yet.</p>}
            <ul className="divide-y divide-slate-100">
              {data.promotions.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <RankBadge rank={p.rank} /> <span className="text-sm text-slate-700">{rewardLabel(p.reward)}</span> <RewardBadge status={p.rewardStatus} />
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Reached {day(p.achievedAt)} with {p.accountsAtPromotion} accounts
                      {p.approvedAt && ` · approved ${day(p.approvedAt)}`}{p.deliveredAt && ` · delivered ${day(p.deliveredAt)}`}
                      {p.cancelledAt && ` · cancelled ${day(p.cancelledAt)}`}{p.note && ` · “${p.note}”`}
                    </span>
                  </span>
                  {isSuper && <RewardButtons status={p.rewardStatus} onAct={(action) => setReward({ promotion: p, action })} />}
                </li>
              ))}
            </ul>
          </section>

          {/* accounts opened */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">Accounts opened ({data.accounts.length})</h2>
            {data.accounts.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No account has been opened with this member as sponsor.</p>}
            <ul className="divide-y divide-slate-100">
              {data.accounts.map((a) => (
                <li key={a.accountNo} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${a.counted ? "" : "bg-red-50/40"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`${accountsPath}/${a.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{a.name}</Link>
                      <span className="font-mono text-[11px] text-slate-500">{a.accountNo}{a.office ? ` · ${a.office}` : ""}</span>
                      {a.accountStatus === "CLOSED" && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Closed</span>}
                      {!a.counted && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Not counted</span>}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Opened {day(a.openedAt)}
                      {!a.counted && ` · excluded${a.excludedAt ? ` ${day(a.excludedAt)}` : ""}${a.excludedBy ? ` by ${a.excludedBy}` : ""}: ${a.excludedReason}`}
                    </span>
                  </span>
                  {a.counted ? (
                    <button type="button" onClick={() => setCredit(a)} className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                      Don&apos;t count
                    </button>
                  ) : (
                    <button type="button" onClick={() => include(a)} className="h-9 shrink-0 rounded-lg border border-emerald-300 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      Count again
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {credit && <ExcludeDialog account={credit} onCancel={() => setCredit(null)} onDone={(msg) => { setCredit(null); changed(msg); }} />}
      {reward && advisor && (
        <RewardDialog promotion={{ ...reward.promotion, member: advisor }} action={reward.action} onCancel={() => setReward(null)}
          onDone={(msg) => { setReward(null); changed(msg); }} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
      <dt className="truncate text-[10px] text-slate-500 uppercase">{label}</dt>
      <dd className="text-lg font-bold text-navy tabular-nums">{value}</dd>
    </div>
  );
}

function ExcludeDialog({ account, onDone, onCancel }: { account: OpenedAccount; onDone: (message: string) => void; onCancel: () => void }) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) { setErrors({ reason: "Give the reason (at least 3 characters)" }); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch<{ accountsOpened: number }>(`/api/customers/ranks/credits/${encodeURIComponent(account.accountNo)}`,
        { method: "POST", body: { counted: false, reason: reason.trim() } });
      onDone(`${account.accountNo} no longer counts — ${r.accountsOpened} accounts. A rank already reached stays.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalForm title="Don't count this account" subtitle={`${account.accountNo} — ${account.name}`} icon="info" danger
      saving={saving} submitLabel="Don't count it" onSubmit={submit} onCancel={onCancel}>
      <p className="text-sm text-slate-600">
        For an invalid account only — e.g. a duplicate person or one opened by mistake. It stops counting towards the sponsor&apos;s
        rank; a rank already reached is not taken away. You can count it again later.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Reason" required error={errors.reason} htmlFor="exclude-reason">
        <input id="exclude-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={inputCls(errors.reason)} />
      </Field>
    </ModalForm>
  );
}
