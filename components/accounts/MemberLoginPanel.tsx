"use client";

import { useCallback, useEffect, useState } from "react";
import { ago, deviceLabel, usePolling } from "@/lib/live/usePolling";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { ApiError } from "@/lib/auth/api";
import { memberPasswordProblems } from "@/lib/accounts/memberPassword";
import { MemberCredentials, type MemberLogin } from "./MemberCredentials";
import { MemberPasswordFields } from "./MemberPasswordFields";

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
  PASSWORD_CHANGED: "ended when the member changed the password",
  REUSE_DETECTED: "ended (token replay detected)",
};

type LoginStatus = {
  accountNo: string;
  hasLogin: boolean;
  username: string | null;
  passwordSetAt: string | null;
  passwordSetBy: "ADMIN" | "MEMBER" | null;
  mustChangePassword: boolean; // the holder must choose their own password first (never set by the office)
  mobileNumber: string; // sign-in and forgot-password OTPs go here
  lastLoginAt: string | null;
  lockedUntil: string | null;
  activeSessions: number;
};

type LoginEvent = { event: string; at: string; ipAddress: string | null; by: string | null; firstLogin: boolean; via: string | null; locked: boolean };

const EVENT_LABEL: Record<string, (e: LoginEvent) => string> = {
  ACCOUNT_OPENED: (e) => `Account opened and password set${e.by ? ` by ${e.by}` : ""}`,
  MEMBER_LOGIN_SET: (e) => `New password set at the office${e.by ? ` by ${e.by}` : ""}`,
  MEMBER_PASSWORD_CHANGED: () => "Member changed their password",
  MEMBER_PASSWORD_RESET_REQUESTED: () => "Forgot password (app): OTP requested",
  MEMBER_PASSWORD_RESET_VERIFIED: () => "Forgot password (app): OTP verified",
  MEMBER_PASSWORD_RESET: () => "Forgot password (app): new password set by the member",
  MEMBER_LOGIN: () => "Signed in",
  MEMBER_LOGIN_FAILED: (e) => (e.locked ? "Wrong password — login locked" : "Wrong password"),
};

/**
 * Account page → the holder's member-portal login (rs_group_Users): username (= account
 * number, always shown), the registered mobile (sign-in and forgot-password OTPs), "Set new
 * password" — for a member who forgot theirs and came to the office: the Admin types it (no OTP)
 * and gives it to the holder (it also creates the login of an account opened before the portal
 * existed and signs the holder out everywhere) — and the credential history. Members can also
 * reset it themselves in the app with an OTP. The stored password is a one-way hash: nobody can
 * read it back, so a new one is set instead.
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
  const [newPw, setNewPw] = useState({ password: "", confirm: "" });
  const [newPwErrors, setNewPwErrors] = useState<{ password?: string; confirm?: string }>({});
  const [history, setHistory] = useState<LoginEvent[] | null>(null);

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
    authFetch<{ items: LoginEvent[] }>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-login/history`, { signal: controller.signal })
      .then((r) => setHistory(r.items), () => setHistory([]));
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  /** The Admin's new initial password; the API never sends a password back. */
  const setPassword = async () => {
    const problems = memberPasswordProblems(newPw.password);
    const found = {
      password: !newPw.password ? "Set a password" : problems.length ? problems.join(" · ")
        : newPw.password.toUpperCase().includes(accountNo) ? "Don't use the account number in the password" : undefined,
      confirm: newPw.password && newPw.confirm !== newPw.password ? "The two passwords don't match" : undefined,
    };
    setNewPwErrors(found);
    if (found.password || found.confirm) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch<{ username: string }>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/member-login`, {
        method: "POST", body: { password: newPw.password },
      });
      setIssued({ username: r.username, password: newPw.password });
      setNewPw({ password: "", confirm: "" });
      setConfirming(false);
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.details.password) setNewPwErrors({ password: err.details.password });
      else setError(errorMessage(err));
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
            <Icon name="refresh" className="size-4" /> {status.hasLogin ? "Set new password (forgotten)" : "Create login"}
          </button>
        )}
      </div>

      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}

      {status && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Item label="Username" value={status.username ?? "No login yet"} mono={!!status.username} />
          <Item label="Password" value={!status.hasLogin ? "—" : status.passwordSetBy === "MEMBER" ? "Changed by the member" : "Set by the office"} />
          <Item label="Registered mobile (OTP)" value={`+91 ${status.mobileNumber}`} mono />
          <Item label="Password set" value={status.passwordSetAt ? formatDateTime(status.passwordSetAt) : "—"} />
          <Item label="Last sign-in" value={status.lastLoginAt ? formatDateTime(status.lastLoginAt) : "Never"} />
          <Item label="Signed in now" value={status.lockedUntil ? `Locked until ${formatDateTime(status.lockedUntil)}` : `${status.activeSessions} session${status.activeSessions === 1 ? "" : "s"}`} />
        </dl>
      )}

      {confirming && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-slate-700">
            {status?.hasLogin
              ? "For a member who forgot the password (no OTP needed here — the member can also reset it in the app with an OTP): the new password replaces the current one at once, unlocks the login and signs the holder out of the app everywhere. Give it to the holder in person — it is shown once, after saving."
              : "Creates the holder's app login (username = account number) with the password you set. Give it to the holder in person — it is shown once, after saving."}
          </p>
          <MemberPasswordFields idPrefix="reset" password={newPw.password} confirm={newPw.confirm} errors={newPwErrors} disabled={busy}
            onChange={(next) => { setNewPw(next); setNewPwErrors({}); }} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setConfirming(false); setNewPw({ password: "", confirm: "" }); setNewPwErrors({}); }} disabled={busy}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={setPassword} disabled={busy}
              className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
              {busy ? "Saving…" : status?.hasLogin ? "Set new password" : "Create login"}
            </button>
          </div>
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
      {history && history.length > 0 && (
        <details className="mt-5 rounded-lg border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">Login &amp; password history ({history.length})</summary>
          <ol className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {history.map((e, i) => (
              <li key={`${e.event}-${e.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
                <span className="text-navy">{(EVENT_LABEL[e.event] ?? (() => e.event))(e)}</span>
                <span className="text-xs text-slate-500">{formatDateTime(e.at)}{e.ipAddress ? ` · IP ${e.ipAddress}` : ""}</span>
              </li>
            ))}
          </ol>
        </details>
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
