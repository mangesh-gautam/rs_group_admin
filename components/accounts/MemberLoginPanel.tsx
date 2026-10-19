"use client";

import { useCallback, useEffect, useState } from "react";
import { ago, deviceLabel, usePolling } from "@/lib/live/usePolling";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { MemberCredentials, type MemberLogin } from "./MemberCredentials";

type MemberSession = {
  id: string;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  active: boolean;
  online: boolean;
  endedAt: string | null;
  endedReason: string | null;
};

const ENDED: Record<string, string> = {
  LOGOUT: "signed out",
  ADMIN_SIGNED_OUT: "signed out by an admin",
  PASSWORD_RESET: "ended by a password reset",
  REUSE_DETECTED: "ended (token replay detected)",
};

type LoginStatus = {
  accountNo: string;
  hasLogin: boolean;
  username: string | null;
  passwordSetAt: string | null;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  activeSessions: number;
};

/**
 * Account page → the holder's member-portal login (rs_group_Users): whether it exists,
 * last sign-in, and "Generate new password" — which also creates the login of an
 * account opened before the portal existed, and signs the holder out everywhere.
 */
export function MemberLoginPanel({ accountNo, mobileNumber }: { accountNo: string; mobileNumber: string }) {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<LoginStatus | null>(null);
  const [issued, setIssued] = useState<MemberLogin | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [sessions, setSessions] = useState<MemberSession[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [signingOut, setSigningOut] = useState<string | null>(null);

  // where the member is signed in — refreshed every 10 s while the page is open
  const loadSessions = useCallback(async (signal: AbortSignal) => {
    const r = await authFetch<{ items: MemberSession[] }>(
      `/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-sessions`, { signal });
    setSessions(r.items);
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version: reload after a sign-out / reset
  }, [authFetch, accountNo, version]);
  usePolling(loadSessions, 10_000);

  const signOut = async (sessionId: string | null) => {
    setSigningOut(sessionId ?? "ALL");
    setError(null);
    try {
      await authFetch(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-sessions/sign-out`, {
        method: "POST", body: sessionId ? { sessionId } : {},
      });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSigningOut(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    authFetch<LoginStatus>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-login`, { signal: controller.signal })
      .then(setStatus, (err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setIssued(await authFetch<MemberLogin>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-login`, { method: "POST" }));
      setConfirming(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="lock" className="size-5 text-brand" /> Member Portal Login
        </h2>
        {status && !confirming && (
          <button type="button" onClick={() => { setConfirming(true); setIssued(null); }}
            className="flex h-9 items-center gap-2 rounded-lg border border-brand/40 px-3 text-sm font-medium text-brand hover:bg-brand-soft">
            <Icon name="refresh" className="size-4" /> {status.hasLogin ? "Generate new password" : "Create login"}
          </button>
        )}
      </div>

      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}

      {status && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Item label="Username" value={status.username ?? "No login yet"} mono={!!status.username} />
          <Item label="Password set" value={status.passwordSetAt ? formatDateTime(status.passwordSetAt) : "—"} />
          <Item label="Last sign-in" value={status.lastLoginAt ? formatDateTime(status.lastLoginAt) : "Never"} />
          <Item label="Signed in now" value={status.lockedUntil ? `Locked until ${formatDateTime(status.lockedUntil)}` : `${status.activeSessions} session${status.activeSessions === 1 ? "" : "s"}`} />
        </dl>
      )}

      {confirming && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="text-slate-700">
            {status?.hasLogin
              ? "A new password replaces the current one and signs the holder out of the portal everywhere."
              : "Creates the holder's portal login (username = account number) with a generated password."}
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={busy}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={generate} disabled={busy}
              className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
              {busy ? "Generating…" : "Generate"}
            </button>
          </span>
        </div>
      )}

      {issued && <div className="mt-4"><MemberCredentials login={issued} mobileNumber={mobileNumber} /></div>}

      {sessions && sessions.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Where the member is signed in <span className="text-xs font-normal text-slate-500">· live</span>
            </h3>
            {sessions.some((x) => x.active) && (
              <button type="button" onClick={() => signOut(null)} disabled={signingOut !== null}
                className="h-8 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
                {signingOut === "ALL" ? "Signing out…" : "Sign out everywhere"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Device</th>
                  <th className="px-3 py-2 font-medium">IP address</th>
                  <th className="px-3 py-2 font-medium">Signed in</th>
                  <th className="px-3 py-2 font-medium">Last activity</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((x) => (
                  <tr key={x.id} className={x.active ? "" : "text-slate-500"}>
                    <td className="px-3 py-2">{deviceLabel(x.userAgent)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{x.ipAddress ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(x.signedInAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{ago(x.lastActiveAt, now)}</td>
                    <td className="px-3 py-2">
                      {x.online ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Online now</span>
                      ) : x.active ? (
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">Signed in (idle)</span>
                      ) : (
                        <span className="text-xs">{x.endedReason ? ENDED[x.endedReason] ?? "ended" : "expired"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {x.active && (
                        <button type="button" onClick={() => signOut(x.id)} disabled={signingOut !== null}
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60">
                          {signingOut === x.id ? "…" : "Sign out"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-navy ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
