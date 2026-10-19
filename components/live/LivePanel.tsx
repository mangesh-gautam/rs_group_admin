"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatAmount } from "@/lib/accounts/types";
import { ago, deviceLabel, usePolling } from "@/lib/live/usePolling";

const POLL_MS = 5_000;
const MAX_EVENTS = 40;

type EventType = "DEPOSIT" | "WITHDRAWAL" | "ACCOUNT_OPENED" | "MEMBER_LOGIN" | "KYC_SUBMITTED" | "ACCOUNT_CLOSED" | "PENALTY_PAID";
type LiveEvent = {
  type: EventType;
  at: string;
  accountNo: string;
  name: string;
  amount: string | null;
  detail: string | null;
  by: string | null;
  office: { name: string; city: string };
};
type OnlineMember = { sessionId: string; accountNo: string; name: string; ipAddress: string | null; userAgent: string | null; signedInAt: string; lastActiveAt: string };
type Snapshot = {
  serverTime: string;
  cursor: string;
  scope: { allOffices: boolean };
  counters: {
    depositsToday: { count: number; total: string };
    withdrawalsToday: { count: number; total: string; paidOut: string };
    accountsOpenedToday: number;
    closuresToday: number;
    membersOnline: number;
    memberSignInsToday: number;
    adminsOnline: number;
    kycWaiting: number;
  };
  online: OnlineMember[];
  events: LiveEvent[];
};

const EVENT: Record<EventType, { icon: IconName; tone: string; text: (e: LiveEvent) => string }> = {
  DEPOSIT: { icon: "download", tone: "bg-emerald-50 text-emerald-700", text: (e) => `Deposit ${formatAmount(e.amount ?? "0")} · ${e.detail ?? ""}` },
  WITHDRAWAL: { icon: "upload", tone: "bg-amber-50 text-amber-700", text: (e) => `Withdrawal ${formatAmount(e.amount ?? "0")} · ${(e.detail ?? "").toLowerCase()}` },
  ACCOUNT_OPENED: { icon: "userPlus", tone: "bg-blue-50 text-blue-700", text: (e) => `Account opened · ${formatAmount(e.amount ?? "0")}` },
  MEMBER_LOGIN: { icon: "lock", tone: "bg-violet-50 text-violet-700", text: (e) => `Signed in to the member portal${e.detail ? ` · IP ${e.detail}` : ""}` },
  KYC_SUBMITTED: { icon: "shieldCheck", tone: "bg-sky-50 text-sky-700", text: (e) => `KYC documents submitted${e.detail === "CUSTOMER" ? " by the holder" : " at the desk"}` },
  ACCOUNT_CLOSED: { icon: "x", tone: "bg-slate-100 text-slate-700", text: (e) => `Account closed${e.detail ? ` · ${e.detail}` : ""}` },
  PENALTY_PAID: { icon: "wallet", tone: "bg-red-50 text-red-700", text: (e) => `Penalty paid ${formatAmount(e.amount ?? "0")}` },
};

/**
 * Dashboard → live view (GET /api/admin/live, every 5 s while the tab is visible):
 * today's counters, members signed in to the portal right now (device, IP, last
 * activity) and the activity feed. Admins see their own office, the Super Admin all.
 */
export function LivePanel({ accountsBase = "/admin/accounts" }: { accountsBase?: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const cursor = useRef<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const params = cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : "";
      const snap = await authFetch<Snapshot>(`/api/admin/live${params}`, { signal });
      const first = cursor.current === null;
      cursor.current = snap.cursor;
      setData(snap);
      setError(null);
      if (snap.events.length) {
        setEvents((old) => {
          const seen = new Set(snap.events.map(key));
          return [...snap.events, ...old.filter((e) => !seen.has(key(e)))].slice(0, MAX_EVENTS);
        });
        if (!first) setFresh(new Set(snap.events.map(key)));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      throw err;
    }
  }, [authFetch]);

  const updatedAt = usePolling(load, POLL_MS);

  // keeps the "x s ago" labels moving between polls; new-event highlight fades after a few seconds
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!fresh.size) return undefined;
    const id = setTimeout(() => setFresh(new Set()), 4000);
    return () => clearTimeout(id);
  }, [fresh]);

  const c = data?.counters;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white" aria-labelledby="live-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 id="live-title" className="flex items-center gap-2 font-semibold text-navy">
          <span className="relative flex size-2.5">
            <span className={`absolute inline-flex size-full rounded-full ${error ? "bg-red-400" : "animate-ping bg-emerald-400 opacity-75 motion-reduce:animate-none"}`} />
            <span className={`relative inline-flex size-2.5 rounded-full ${error ? "bg-red-500" : "bg-emerald-500"}`} />
          </span>
          Live Activity
          <span className="text-xs font-normal text-slate-500">{data?.scope.allOffices ? "· all offices" : "· your office"}</span>
        </h2>
        <span className="text-xs text-slate-500" aria-live="polite">
          {error ? <span className="text-red-600">Reconnecting… {error}</span> : updatedAt ? `Updated ${ago(updatedAt, now)}` : "Connecting…"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        <Counter label="Deposits today" value={c ? formatAmount(c.depositsToday.total) : "—"} hint={c ? `${c.depositsToday.count} receipts` : undefined} />
        <Counter label="Withdrawals today" value={c ? formatAmount(c.withdrawalsToday.total) : "—"} hint={c ? `${c.withdrawalsToday.count} · paid ${formatAmount(c.withdrawalsToday.paidOut)}` : undefined} />
        <Counter label="Members online" value={c ? String(c.membersOnline) : "—"} hint={c ? `${c.memberSignInsToday} portal sign-ins today` : undefined} highlight={!!c?.membersOnline} />
        <Counter label="Staff online" value={c ? String(c.adminsOnline) : "—"} />
        <Counter label="New accounts today" value={c ? String(c.accountsOpenedToday) : "—"} />
        <Counter label="Closed today" value={c ? String(c.closuresToday) : "—"} />
        <Counter label="KYC waiting" value={c ? String(c.kycWaiting) : "—"} highlight={!!c?.kycWaiting} />
        <Counter label="Server time" value={data ? new Date(data.serverTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"} />
      </dl>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="border-b border-slate-100 p-5 lg:border-r lg:border-b-0">
          <h3 className="mb-3 text-sm font-semibold text-navy">Members signed in now</h3>
          {!data ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : data.online.length === 0 ? (
            <p className="text-sm text-slate-500">No member is using the portal right now.</p>
          ) : (
            <ul className="space-y-2">
              {data.online.map((m) => (
                <li key={m.sessionId} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-2.5 text-sm">
                  <div className="min-w-0">
                    <Link href={`${accountsBase}/${m.accountNo}`} className="font-medium text-navy hover:underline">{m.name}</Link>
                    <p className="font-mono text-xs text-slate-500">{m.accountNo}</p>
                    <p className="text-xs text-slate-600">{deviceLabel(m.userAgent)}{m.ipAddress ? ` · IP ${m.ipAddress}` : ""}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> {ago(m.lastActiveAt, now)}</span>
                    <span className="block">since {new Date(m.signedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-navy">Activity</h3>
          {!data ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">No activity in the last 7 days.</p>
          ) : (
            <ol className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
              {events.map((e) => {
                const meta = EVENT[e.type];
                return (
                  <li key={key(e)} className={`flex items-start gap-3 rounded-lg p-2 text-sm transition-colors duration-1000 ${fresh.has(key(e)) ? "bg-emerald-50" : ""}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon name={meta.icon} className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <Link href={`${accountsBase}/${e.accountNo}`} className="font-medium text-navy hover:underline">{e.name}</Link>
                        <span className="ml-1 font-mono text-xs text-slate-500">{e.accountNo}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {meta.text(e)}{e.by ? ` · by ${e.by}` : ""}{data.scope.allOffices ? ` · ${e.office.name}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs whitespace-nowrap text-slate-500" dateTime={e.at} title={new Date(e.at).toLocaleString("en-IN")}>{ago(e.at, now)}</time>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

const key = (e: LiveEvent) => `${e.type}|${e.at}|${e.accountNo}`;

function Counter({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className="bg-white px-5 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold ${highlight ? "text-emerald-700" : "text-navy"}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-slate-500">{hint}</dd>}
    </div>
  );
}
