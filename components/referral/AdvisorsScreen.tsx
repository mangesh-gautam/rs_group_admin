"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import type { KycStatus } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { accountTypeLabel, money, type AccountType } from "@/lib/deposits/types";
import { NetworkTree } from "./ReferralTree";

type Advisor = {
  accountNo: string;
  name: string;
  mobileNumber: string;
  kycStatus: KycStatus;
  openedAt: string;
  office: { id: number; name: string; city: string };
  sponsor: { accountNo: string; name: string } | null;
  directCount: number; // accounts this member referred
  teamCount: number; // all levels below
  team5: number; // within the 5 commission levels
  commissionEarned: string;
  lastReferralAt: string | null;
};
type AdvisorPage = { page: number; pageSize: number; total: number; items: Advisor[]; referredTotal: number };

type Referred = {
  accountNo: string;
  name: string;
  level: number;
  referredBy: { accountNo: string; name: string };
  openedAt: string;
  accountType: AccountType;
  openingAmount: string;
  kycStatus: KycStatus;
  office: { name: string; city: string };
  openedBy: string;
  visible: boolean;
  balance: string | null;
  directCount: number;
  commissionToAdvisor: string;
};
type ReferralsResponse = {
  advisor: { accountNo: string; sponsor: { accountNo: string; name: string } | null; directCount: number; networkSize: number; networkByLevel: Record<string, number>; commissionEarned: string };
  depth: number;
  items: Referred[];
};

type Sort = "DIRECT" | "TEAM" | "EARNED" | "RECENT" | "NAME";
const SORTS: { id: Sort; label: string }[] = [
  { id: "DIRECT", label: "Most referrals" },
  { id: "TEAM", label: "Largest team" },
  { id: "EARNED", label: "Most commission" },
  { id: "RECENT", label: "Latest referral" },
  { id: "NAME", label: "Name" },
];
const PAGE_SIZE = 25;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Advisors: members who referred (sponsored) other accounts — how many they
 * opened directly, their whole team, commission earned. Selecting one shows
 * every account they referred (direct or all levels) or their network as a tree.
 */
export function AdvisorsScreen({ initial, basePath, treePath }: { initial: string | null; basePath: string; treePath: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("DIRECT");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdvisorPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initial);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (all) params.set("all", "1");
    authFetch<AdvisorPage>(`/api/customers/advisors?${params}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, q, sort, all, page]);

  const select = (accountNo: string) => {
    setSelected(accountNo);
    router.replace(`${basePath}?advisor=${accountNo}`, { scroll: false });
    // stacked layout (below xl): bring the panel into view
    if (window.matchMedia("(max-width: 1279px)").matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const top = data?.items[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <Icon name="handCoins" className="size-6 text-brand" /> Advisors
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Members who referred other accounts. Select one to see every account they referred, or their network as a tree.
        </p>
      </div>

      {data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={all ? "Members" : "Advisors"} value={String(data.total)} />
          <Stat label="Accounts referred" value={String(data.referredTotal)} />
          {top && sort === "DIRECT" && !q && top.directCount > 0 ? (
            <Stat label="Top advisor" value={`${top.name} · ${top.directCount}`} />
          ) : (
            <Stat label="On this page" value={String(data.items.length)} />
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search advisors</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, account no. or mobile"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-brand">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setPage(1); }} className="size-4 accent-[var(--color-brand)]" />
          Include members with no referrals
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* ---- list ---- */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {!data && !error && <div className="m-4 h-64 animate-pulse rounded-xl bg-slate-100" />}
          {data && data.items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {q ? "No member matches this search." : "Nobody has referred an account yet — choose a Sponsor ID when opening an account."}
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {data?.items.map((a, i) => (
              <li key={a.accountNo}>
                <button type="button" onClick={() => select(a.accountNo)} aria-current={selected === a.accountNo}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition sm:px-4 ${selected === a.accountNo ? "bg-brand-soft" : "hover:bg-slate-50"}`}>
                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-slate-400 tabular-nums">{(page - 1) * PAGE_SIZE + i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">{a.name}</span>
                      {a.kycStatus !== "VERIFIED" && <KycStatusBadge status={a.kycStatus} />}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-slate-500">{a.accountNo}</span>
                    <span className="block text-[11px] text-slate-500">
                      <span className="text-emerald-700 sm:hidden">Earned {money(a.commissionEarned)} · </span>
                      Team {a.teamCount} · within 5 levels {a.team5}
                      {a.lastReferralAt && ` · last referral ${day(a.lastReferralAt)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xl font-bold text-navy tabular-nums">{a.directCount}</span>
                    <span className="block text-[10px] text-slate-500 uppercase">referred</span>
                  </span>
                  <span className="hidden w-24 shrink-0 text-right sm:block">
                    <span className="block text-sm font-semibold text-emerald-700 tabular-nums">{money(a.commissionEarned)}</span>
                    <span className="block text-[10px] text-slate-500 uppercase">earned</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              <span>Page {page} of {pages}</span>
              <span className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
              </span>
            </div>
          )}
        </div>

        {/* ---- detail ---- */}
        <div ref={detailRef} className="scroll-mt-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:rounded-2xl">
          {selected ? (
            <AdvisorDetail key={selected} accountNo={selected} name={data?.items.find((a) => a.accountNo === selected)?.name} treePath={treePath}
              commissionPath={basePath.replace(/advisors$/, "advisor-commission")} />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              <span>
                <Icon name="users" className="mx-auto mb-2 size-8 text-slate-300" />
                Select an advisor to see the accounts they referred.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdvisorDetail({ accountNo, name, treePath, commissionPath }: { accountNo: string; name?: string; treePath: string; commissionPath: string }) {
  const { authFetch } = useAuth();
  const [view, setView] = useState<"list" | "tree">("list");
  const [depth, setDepth] = useState<"1" | "all">("1");
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<ReferralsResponse>(`/api/customers/advisors/${encodeURIComponent(accountNo)}/referrals?depth=${depth}`, { signal: controller.signal }).then(
      (d) => { setData(d); setError(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, accountNo, depth]);

  const a = data?.advisor;
  return (
    <section className="@container/panel rounded-2xl border border-slate-200 bg-white">
      <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-navy">{name ?? accountNo}</h2>
            <p className="font-mono text-xs text-slate-500">{accountNo}</p>
            {a && (
              <p className="mt-1 text-xs text-slate-600">
                {a.sponsor ? <>Referred by <Link href={`/admin/accounts/${a.sponsor.accountNo}`} className="text-brand hover:underline">{a.sponsor.name}</Link></> : "No sponsor — top of the network"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${commissionPath}/${accountNo}`} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50">
              <Icon name="wallet" className="size-4" /> Commission
            </Link>
            <Link href={`/admin/accounts/${accountNo}`} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50">
              <Icon name="user" className="size-4" /> Account
            </Link>
            <Link href={`${treePath}?root=${accountNo}`} className="flex h-9 items-center gap-1.5 rounded-lg border border-brand/40 px-3 text-xs font-medium text-brand hover:bg-brand-soft">
              <Icon name="users" className="size-4" /> Full tree
            </Link>
          </div>
        </div>
        {a && (
          <dl className="grid grid-cols-1 gap-2 @sm/panel:grid-cols-3">
            <Mini label="Referred directly" value={String(a.directCount)} />
            <Mini label="Network (5 levels)" value={String(a.networkSize)} />
            <Mini label="Commission earned" value={money(a.commissionEarned)} tone="green" />
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5" role="tablist" aria-label="View">
            {(["list", "tree"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${view === v ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon name={v === "list" ? "fileText" : "users"} className="size-3.5" /> {v === "list" ? "Referred accounts" : "Tree diagram"}
              </button>
            ))}
          </div>
          {view === "list" && (
            <div className="flex gap-1.5 text-xs" role="group" aria-label="Levels">
              {([["1", "Direct only"], ["all", "All levels"]] as const).map(([d, label]) => (
                <button key={d} type="button" onClick={() => setDepth(d)} aria-pressed={depth === d}
                  className={`rounded-full border px-3 py-1 font-medium ${depth === d ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="p-5"><Alert tone="error">{error}</Alert></div>}

      {view === "tree" ? (
        <div className="p-2 sm:p-4"><NetworkTree root={accountNo} treePath={treePath} /></div>
      ) : !data ? (
        <div className="m-5 h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : data.items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">This member hasn&apos;t referred any account yet.</p>
      ) : (
        <>
        {/* narrow panel: one card per account */}
        <ul className="divide-y divide-slate-100 @2xl/panel:hidden">
          {data.items.map((r) => (
            <li key={r.accountNo} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    {r.visible ? (
                      <Link href={`/admin/accounts/${r.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{r.name}</Link>
                    ) : <span className="font-medium text-navy">{r.name}</span>}
                    {depth === "all" && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.level <= 5 ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>L{r.level}</span>
                    )}
                    {r.kycStatus !== "VERIFIED" && <KycStatusBadge status={r.kycStatus} />}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500">{r.accountNo}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-700 tabular-nums">{money(r.commissionToAdvisor)}</p>
                  <p className="text-[10px] text-slate-500 uppercase">paid to advisor</p>
                </div>
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                <span>Opened {day(r.openedAt)}</span>
                <span>{accountTypeLabel(r.accountType)} · {money(r.openingAmount)}</span>
                <span>Balance {r.balance === null ? `— (${r.office.name} office)` : <b className="font-medium text-navy">{money(r.balance)}</b>}</span>
                {r.level > 1 && <span>via {r.referredBy.name}</span>}
                {r.directCount > 0 && <span className="text-brand">referred {r.directCount} more</span>}
              </p>
            </li>
          ))}
        </ul>
        {/* wide panel: table */}
        <div className="hidden max-h-[32rem] overflow-auto @2xl/panel:block">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Account</th>
                {depth === "all" && <th className="px-4 py-2.5 font-medium">Level</th>}
                <th className="px-4 py-2.5 font-medium">Opened</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th className="px-4 py-2.5 text-right font-medium">Paid to advisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <tr key={r.accountNo} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.visible ? (
                        <Link href={`/admin/accounts/${r.accountNo}`} className="font-medium text-navy hover:text-brand hover:underline">{r.name}</Link>
                      ) : <span className="font-medium text-navy">{r.name}</span>}
                      {r.kycStatus !== "VERIFIED" && <KycStatusBadge status={r.kycStatus} />}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-500">{r.accountNo}</span>
                    {r.directCount > 0 && <span className="block text-[11px] text-brand">referred {r.directCount} more</span>}
                  </td>
                  {depth === "all" && (
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${r.level <= 5 ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>L{r.level}</span>
                      {r.level > 1 && <span className="mt-1 block text-[11px] text-slate-500">via {r.referredBy.name}</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {day(r.openedAt)}
                    <span className="block text-[11px] text-slate-400" title={formatDateTime(r.openedAt)}>by {r.openedBy}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {accountTypeLabel(r.accountType)}
                    <span className="block text-[11px] text-slate-500">opened with {money(r.openingAmount)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-navy tabular-nums">
                    {r.balance === null ? <span className="text-xs font-normal text-slate-400">{r.office.name} office</span> : money(r.balance)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 tabular-nums">{money(r.commissionToAdvisor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-bold text-navy tabular-nums">{value}</dd>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className={`rounded-lg p-2.5 ${tone === "green" ? "bg-emerald-50" : "bg-slate-50"}`}>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`text-base font-bold tabular-nums ${tone === "green" ? "text-emerald-700" : "text-navy"}`}>{value}</dd>
    </div>
  );
}
