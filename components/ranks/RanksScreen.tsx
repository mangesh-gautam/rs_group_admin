"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ModalForm } from "@/components/ui/ModalForm";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  REWARD_STATUS,
  day,
  rewardLabel,
  type Promotion,
  type PromotionPage,
  type Rank,
  type RankProgressPage,
  type RewardStatus,
} from "@/lib/ranks/types";

const PAGE_SIZE = 25;
type Tab = "progress" | "rewards" | "settings";

/**
 * Ranks & Rewards: how many accounts each member has opened (as direct sponsor), the rank
 * they reached and how many more they need for the next one; the rewards to approve and
 * hand over; and the rank settings. Members are promoted automatically by the database —
 * only the Super Admin changes ranks and reward status.
 */
export function RanksScreen({ basePath }: { basePath: string }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<Tab>("progress");
  const [ranks, setRanks] = useState<Rank[] | null>(null);
  const [version, setVersion] = useState(0); // bumped after a rank change → everything reloads
  const { authFetch } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    authFetch<{ items: Rank[] }>("/api/customers/ranks", { signal: controller.signal }).then((d) => setRanks(d.items), () => {});
    return () => controller.abort();
  }, [authFetch, version]);

  const active = ranks?.filter((r) => r.isActive) ?? [];
  const tabs: { id: Tab; label: string; icon: "users" | "gift" | "settings" }[] = [
    { id: "progress", label: "Advisor progress", icon: "users" },
    { id: "rewards", label: "Rewards", icon: "gift" },
    { id: "settings", label: "Rank settings", icon: "settings" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <Icon name="crown" className="size-6 text-brand" /> Ranks &amp; Rewards
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Every account opened with a member as its sponsor counts towards their rank as soon as it is opened. Members are
          promoted automatically when they reach a target; the reward is then approved and handed over.
        </p>
      </div>

      {/* the rank ladder */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {!ranks && Array.from({ length: 5 }, (_, i) => <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        {active.map((r, i) => (
          <li key={r.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <span className="block truncate text-xs font-semibold text-brand">{i + 1}. {r.name}</span>
            <span className="block text-lg font-bold text-navy tabular-nums">{r.target.toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-500">accounts</span></span>
            <span className="flex items-center gap-1 truncate text-[11px] text-slate-600"><Icon name="gift" className="size-3 shrink-0" /> {rewardLabel(r.reward)}</span>
            <span className="block text-[10px] text-slate-400">{r.achievedCount} reached</span>
          </li>
        ))}
      </ol>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-navy"}`}>
            <Icon name={t.icon} className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "progress" && <ProgressTab ranks={active} basePath={basePath} key={version} />}
      {tab === "rewards" && <RewardsTab isSuper={isSuper} basePath={basePath} />}
      {tab === "settings" && <SettingsTab ranks={ranks} isSuper={isSuper} onChanged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

/* ---- advisor progress ------------------------------------------------------------------------- */

function ProgressTab({ ranks, basePath }: { ranks: Rank[]; basePath: string }) {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RankProgressPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (rank) params.set("rank", rank);
    authFetch<RankProgressPage>(`/api/customers/ranks/advisors?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, q, rank, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search members</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Member name, account no. or mobile"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <label className="w-full text-sm text-slate-600 sm:w-56">
          <span className="sr-only">Current rank</span>
          <select value={rank} onChange={(e) => { setRank(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-brand">
            <option value="">Every rank</option>
            <option value="NONE">No rank yet</option>
            {ranks.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <section className="@container/list overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {!data && !error && <div className="m-4 h-64 animate-pulse rounded-xl bg-slate-100" />}
        {data && data.items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {q || rank ? "No member matches these filters." : "No member has opened an account for someone yet."}
          </p>
        )}
        {data && data.items.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100 @3xl/list:hidden">
              {data.items.map((r) => (
                <li key={r.member.accountNo}>
                  <Link href={`${basePath}/${r.member.accountNo}`} className="block space-y-1.5 px-4 py-3 hover:bg-slate-50">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium text-navy">{r.member.name}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-500">{r.member.accountNo} · {r.member.office.name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-bold text-navy tabular-nums">{r.accountsOpened}</span>
                        <span className="block text-[10px] text-slate-500 uppercase">accounts</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <RankBadge rank={r.currentRank} />
                      {r.pendingRewards > 0 && <PendingBadge count={r.pendingRewards} />}
                    </span>
                    <NextRank row={r} />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto @3xl/list:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Member</th>
                    <th className="px-3 py-2.5 text-right font-medium">Accounts opened</th>
                    <th className="px-3 py-2.5 font-medium">Current rank</th>
                    <th className="px-3 py-2.5 font-medium">Next rank</th>
                    <th className="px-3 py-2.5 font-medium">Last opened</th>
                    <th className="px-4 py-2.5 font-medium">Rewards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((r) => (
                    <tr key={r.member.accountNo} className="hover:bg-brand-soft/50">
                      <td className="px-4 py-2.5">
                        <Link href={`${basePath}/${r.member.accountNo}`} className="block">
                          <span className="block font-medium text-navy hover:text-brand hover:underline">{r.member.name}</span>
                          <span className="block font-mono text-[11px] text-slate-500">{r.member.accountNo} · {r.member.office.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-navy tabular-nums">
                        {r.accountsOpened}
                        {r.excluded > 0 && <span className="block text-[10px] font-normal text-red-600">{r.excluded} excluded</span>}
                      </td>
                      <td className="px-3 py-2.5"><RankBadge rank={r.currentRank} /></td>
                      <td className="min-w-48 px-3 py-2.5"><NextRank row={r} /></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{r.lastOpenedAt ? day(r.lastOpenedAt) : "—"}</td>
                      <td className="px-4 py-2.5">{r.pendingRewards > 0 ? <PendingBadge count={r.pendingRewards} /> : <span className="text-xs text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
      </section>
    </div>
  );
}

function NextRank({ row }: { row: RankProgressPage["items"][number] }) {
  if (!row.nextRank) return <span className="text-xs font-medium text-emerald-700">Highest rank reached</span>;
  const pct = Math.min(100, Math.floor((row.accountsOpened * 100) / row.nextRank.target));
  return (
    <span className="block">
      <span className="flex justify-between gap-2 text-[11px] text-slate-600">
        <span className="truncate">{row.nextRank.name}</span>
        <span className="shrink-0 font-medium text-navy tabular-nums">{row.nextRank.remaining} more</span>
      </span>
      <ProgressBar value={pct} label={`${row.accountsOpened} of ${row.nextRank.target} accounts for ${row.nextRank.name}`} />
    </span>
  );
}

/* ---- rewards ---------------------------------------------------------------------------------- */

function RewardsTab({ isSuper, basePath }: { isSuper: boolean; basePath: string }) {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<RewardStatus | null>("PENDING");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PromotionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ promotion: Promotion; action: RewardAction } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    authFetch<PromotionPage>(`/api/customers/ranks/promotions?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, status, q, page, version]);

  const chip = (s: RewardStatus | null, label: string, count?: number) => (
    <button key={label} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}
      className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium ${status === s ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {label}
      {count !== undefined && <span className={`rounded-full px-1.5 tabular-nums ${status === s ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      {!isSuper && <Alert tone="info">Rewards are approved and marked delivered by the Super Admin. You can see their status here.</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by reward status">
        {chip("PENDING", "Pending", data?.counts.pending)}
        {chip("APPROVED", "Approved", data?.counts.approved)}
        {chip("DELIVERED", "Delivered", data?.counts.delivered)}
        {chip("CANCELLED", "Cancelled", data?.counts.cancelled)}
        {chip(null, "All")}
        <label className="relative w-full sm:ml-auto sm:w-72">
          <span className="sr-only">Search members</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Member name or account no."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {!data && !error && <div className="m-4 h-48 animate-pulse rounded-xl bg-slate-100" />}
        {data && data.items.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No rewards here.</p>}
        <ul className="divide-y divide-slate-100">
          {data?.items.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`${basePath}/${p.member.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{p.member.name}</Link>
                  <span className="font-mono text-[11px] text-slate-500">{p.member.accountNo} · {p.member.office}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <RankBadge rank={p.rank} />
                  <span className="flex items-center gap-1"><Icon name="gift" className="size-3.5 text-brand" /> {rewardLabel(p.reward)}</span>
                  <RewardBadge status={p.rewardStatus} />
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Reached {day(p.achievedAt)} with {p.accountsAtPromotion} accounts (target {p.target})
                  {p.approvedAt && ` · approved ${day(p.approvedAt)}${p.approvedBy ? ` by ${p.approvedBy}` : ""}`}
                  {p.deliveredAt && ` · delivered ${day(p.deliveredAt)}${p.deliveredBy ? ` by ${p.deliveredBy}` : ""}`}
                  {p.cancelledAt && ` · cancelled ${day(p.cancelledAt)}${p.cancelledBy ? ` by ${p.cancelledBy}` : ""}`}
                  {p.note && ` · “${p.note}”`}
                </span>
              </span>
              {isSuper && <RewardButtons status={p.rewardStatus} onAct={(action) => setActing({ promotion: p, action })} />}
            </li>
          ))}
        </ul>
        {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
      </section>

      {acting && (
        <RewardDialog promotion={acting.promotion} action={acting.action} onCancel={() => setActing(null)}
          onDone={(msg) => { setActing(null); setDone(msg); setVersion((v) => v + 1); }} />
      )}
    </div>
  );
}

export type RewardAction = "APPROVE" | "DELIVER" | "CANCEL";

/** The next steps a reward can take (Super Admin). */
export function RewardButtons({ status, onAct }: { status: RewardStatus; onAct: (a: RewardAction) => void }) {
  if (status === "DELIVERED" || status === "CANCELLED") return null;
  return (
    <span className="flex shrink-0 gap-2">
      {status === "PENDING" && (
        <button type="button" onClick={() => onAct("APPROVE")} className="h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-brand/90">Approve</button>
      )}
      {status === "APPROVED" && (
        <button type="button" onClick={() => onAct("DELIVER")} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">Mark delivered</button>
      )}
      <button type="button" onClick={() => onAct("CANCEL")} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50">Cancel</button>
    </span>
  );
}

const ACTION_TEXT: Record<RewardAction, { title: string; button: string; done: string }> = {
  APPROVE: { title: "Approve reward", button: "Approve", done: "approved" },
  DELIVER: { title: "Mark reward delivered", button: "Mark delivered", done: "marked delivered" },
  CANCEL: { title: "Cancel reward", button: "Cancel reward", done: "cancelled" },
};

export function RewardDialog({ promotion, action, onDone, onCancel }: {
  promotion: Pick<Promotion, "id" | "rank" | "reward"> & { member: { accountNo: string; name: string } };
  action: RewardAction; onDone: (message: string) => void; onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = ACTION_TEXT[action];

  const submit = async () => {
    if (action === "CANCEL" && note.trim().length < 3) { setErrors({ note: "Give the reason (at least 3 characters)" }); return; }
    setSaving(true);
    setError(null);
    try {
      await authFetch(`/api/customers/ranks/promotions/${promotion.id}`, { method: "POST", body: { action, note: note.trim() || undefined } });
      onDone(`${promotion.member.name}'s ${promotion.rank.name} reward (${rewardLabel(promotion.reward)}) ${t.done}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalForm title={t.title} subtitle={`${promotion.member.accountNo} — ${promotion.member.name}`} icon="gift" danger={action === "CANCEL"}
      saving={saving} submitLabel={t.button} onSubmit={submit} onCancel={onCancel}>
      <p className="text-sm text-slate-700">
        <span className="font-medium">{promotion.rank.name}</span> · {rewardLabel(promotion.reward)}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={action === "CANCEL" ? "Reason" : "Note"} required={action === "CANCEL"} optional={action !== "CANCEL"} error={errors.note} htmlFor="reward-note"
        hint={action === "DELIVER" ? "e.g. handed over at the branch, invoice no." : undefined}>
        <input id="reward-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={inputCls(errors.note)} />
      </Field>
    </ModalForm>
  );
}

/* ---- rank settings ---------------------------------------------------------------------------- */

function SettingsTab({ ranks, isSuper, onChanged }: { ranks: Rank[] | null; isSuper: boolean; onChanged: () => void }) {
  const { authFetch } = useAuth();
  const [editing, setEditing] = useState<Rank | "new" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const toggle = async (r: Rank) => {
    setBusy(r.id);
    setError(null);
    try {
      const res = await authFetch<{ promoted: number }>(`/api/customers/ranks/${r.id}/active`, { method: "PATCH", body: { active: !r.isActive } });
      setDone(`${r.name} ${r.isActive ? "deactivated" : `activated${res.promoted ? ` — ${res.promoted} member(s) promoted` : ""}`}.`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {!isSuper && <Alert tone="info">Only the Super Admin can add or change ranks.</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {isSuper && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing("new")}
            className="flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90">
            <Icon name="plus" className="size-4" /> Add rank
          </button>
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {!ranks && <div className="m-4 h-48 animate-pulse rounded-xl bg-slate-100" />}
        <ul className="divide-y divide-slate-100">
          {ranks?.map((r) => (
            <li key={r.id} className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${r.isActive ? "" : "bg-slate-50"}`}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy">{r.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{r.code}</span>
                  {!r.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Inactive</span>}
                </span>
                <span className="mt-0.5 block text-sm text-slate-700">
                  <span className="font-medium tabular-nums">{r.target.toLocaleString("en-IN")}</span> accounts ·{" "}
                  <Icon name="gift" className="inline size-3.5 text-brand" /> {rewardLabel(r.reward)}
                </span>
                {r.reward.description && <span className="block text-[11px] text-slate-500">{r.reward.description}</span>}
                <span className="block text-[11px] text-slate-400">
                  {r.achievedCount} member(s) reached · updated {day(r.updatedAt)}{r.updatedBy ? ` by ${r.updatedBy}` : ""}
                </span>
              </span>
              {isSuper && (
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setEditing(r)} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50">
                    <Icon name="edit" className="size-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => toggle(r)} disabled={busy === r.id}
                    className={`h-9 rounded-lg border px-3 text-xs font-medium disabled:opacity-50 ${r.isActive ? "border-slate-200 text-red-700 hover:bg-red-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                    {r.isActive ? "Deactivate" : "Activate"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-slate-500">
        A reached rank is never taken away: raising a target or deactivating a rank only affects members who haven&apos;t reached it.
        Lowering a target (or adding a rank) promotes every member who already qualifies.
      </p>
      {editing && (
        <RankDialog rank={editing === "new" ? null : editing} onCancel={() => setEditing(null)}
          onDone={(msg) => { setEditing(null); setDone(msg); onChanged(); }} />
      )}
    </div>
  );
}

function RankDialog({ rank, onDone, onCancel }: { rank: Rank | null; onDone: (message: string) => void; onCancel: () => void }) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    code: rank?.code ?? "", name: rank?.name ?? "", target: rank ? String(rank.target) : "",
    rewardTitle: rank?.reward.title ?? "", rewardValue: rank?.reward.value ?? "", rewardDescription: rank?.reward.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!/^[A-Za-z][A-Za-z0-9_ ]{1,19}$/.test(form.code.trim())) found.code = "2–20 letters, digits or _ (e.g. PLATINUM)";
    if (!form.name.trim()) found.name = "Enter a name";
    if (!/^\d{1,7}$/.test(form.target.trim()) || Number(form.target) < 1) found.target = "Enter the number of accounts (1 or more)";
    if (!form.rewardTitle.trim()) found.rewardTitle = "Enter the reward";
    if (form.rewardValue.trim() && !/^\d{1,10}(\.\d{1,2})?$/.test(form.rewardValue.replace(/,/g, "").trim())) found.rewardValue = "Enter an amount or leave empty";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, target: Number(form.target), rewardValue: form.rewardValue.replace(/,/g, "").trim() || null, isActive: rank?.isActive ?? true };
      const r = await authFetch<{ promoted: number }>(rank ? `/api/customers/ranks/${rank.id}` : "/api/customers/ranks", { method: rank ? "PUT" : "POST", body });
      onDone(`${form.name.trim()} ${rank ? "saved" : "added"}${r.promoted ? ` — ${r.promoted} member(s) promoted` : ""}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <ModalForm title={rank ? `Edit ${rank.name}` : "Add rank"} subtitle={rank ? rank.code : "A new rank on the ladder"} icon="crown"
      saving={saving} submitLabel={rank ? "Save rank" : "Add rank"} onSubmit={submit} onCancel={onCancel}>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Code" required error={errors.code} htmlFor="rank-code" hint="Can't be changed later">
          <input id="rank-code" value={form.code} onChange={set("code")} disabled={!!rank} maxLength={20} className={`${inputCls(errors.code)} uppercase`} />
        </Field>
        <Field label="Name" required error={errors.name} htmlFor="rank-name">
          <input id="rank-name" value={form.name} onChange={set("name")} maxLength={60} className={inputCls(errors.name)} />
        </Field>
      </div>
      <Field label="Accounts to open" required error={errors.target} htmlFor="rank-target" hint="Accounts opened with the member as direct sponsor">
        <input id="rank-target" inputMode="numeric" value={form.target} onChange={set("target")} className={inputCls(errors.target)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Reward" required error={errors.rewardTitle} htmlFor="rank-reward">
          <input id="rank-reward" value={form.rewardTitle} onChange={set("rewardTitle")} maxLength={120} className={inputCls(errors.rewardTitle)} placeholder="e.g. Watch" />
        </Field>
        <Field label="Value (₹)" optional error={errors.rewardValue} htmlFor="rank-value">
          <input id="rank-value" inputMode="decimal" value={form.rewardValue} onChange={set("rewardValue")} className={inputCls(errors.rewardValue)} />
        </Field>
      </div>
      <Field label="Description" optional error={errors.rewardDescription} htmlFor="rank-desc">
        <textarea id="rank-desc" value={form.rewardDescription} onChange={set("rewardDescription")} maxLength={500} rows={2}
          className={`${inputCls(errors.rewardDescription)} h-auto py-2`} />
      </Field>
    </ModalForm>
  );
}

/* ---- shared bits ------------------------------------------------------------------------------ */

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <span role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
      <span className={`block h-full rounded-full ${value >= 100 ? "bg-emerald-500" : "bg-brand"}`} style={{ width: `${value}%` }} />
    </span>
  );
}

export function RankBadge({ rank }: { rank: { name: string } | null }) {
  return rank
    ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand"><Icon name="crown" className="size-3" /> {rank.name}</span>
    : <span className="text-xs text-slate-400">No rank yet</span>;
}

export function RewardBadge({ status }: { status: RewardStatus }) {
  const s = REWARD_STATUS[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ${s.className}`}>{s.label}</span>;
}

function PendingBadge({ count }: { count: number }) {
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{count} reward{count === 1 ? "" : "s"} pending</span>;
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
      <span>Page {page} of {pages}</span>
      <span className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
      </span>
    </div>
  );
}
