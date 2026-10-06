"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatDateTime, type ActiveSession, type Coordinates } from "@/lib/auth/types";
import { useActiveSessions } from "./useActiveSessions";

/** "just now", "4 min ago", "2 h ago". */
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
};

/** Short "Chrome on macOS" label from a user-agent string. */
const device = (ua: string | null) => {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
};

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

function LocationLink({ location }: { location: Coordinates | null }) {
  if (!location) return <span className="text-slate-400">—</span>;
  const { latitude, longitude, accuracy } = location;
  return (
    <a
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-brand hover:underline"
    >
      {latitude.toFixed(4)}, {longitude.toFixed(4)}
      {accuracy != null && <span className="text-slate-500"> (±{Math.round(accuracy)} m)</span>}
    </a>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

/** Super Admin → Active Sessions: every Admin signed in right now. */
export function ActiveSessions() {
  const router = useRouter();
  const { sessions, error, loading, updatedAt, reload } = useActiveSessions();
  const open = (s: ActiveSession) => router.push(`/super-admin/admin-management/${s.admin.id}`);
  const adminCount = new Set(sessions?.map((s) => s.admin.id)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">Super Admin</p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold text-navy sm:text-3xl">
            Active Sessions {sessions && sessions.length > 0 && <LiveDot />}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {sessions
              ? `${adminCount} admin${adminCount === 1 ? "" : "s"} signed in right now · ${sessions.length} session${
                  sessions.length === 1 ? "" : "s"
                }`
              : "Admins who are signed in right now."}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex h-11 items-center gap-2 rounded-lg border border-brand/50 px-5 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
        >
          <Icon name="refresh" className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        {error ? (
          <div className="p-4">
            <Alert tone="error">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline">
                Retry
              </button>
            </Alert>
          </div>
        ) : (
          <>
            {/* Phones: one card per session */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {!sessions &&
                Array.from({ length: 2 }, (_, i) => (
                  <li key={i} className="p-4">
                    <div className="h-12 animate-pulse rounded bg-slate-100" />
                  </li>
                ))}
              {sessions?.map((s) => (
                <li key={s.sessionId}>
                  <button
                    type="button"
                    onClick={() => open(s)}
                    className="flex w-full items-start gap-3 p-4 text-left active:bg-slate-50"
                  >
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                      {initials(s.admin.fullName)}
                      <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
                    </span>
                    <div className="min-w-0 flex-1 text-xs text-slate-500">
                      <p className="truncate text-sm font-medium text-navy">{s.admin.fullName}</p>
                      <p className="truncate">
                        @{s.admin.username} · {s.admin.employeeId ?? "—"}
                      </p>
                      <p className="mt-1">
                        Active {ago(s.lastActiveAt)} · signed in {formatDateTime(s.signedInAt)}
                      </p>
                      <p className="mt-0.5">
                        {device(s.userAgent)} · {s.ipAddress || "—"}
                      </p>
                      <p className="mt-0.5">
                        <LocationLink location={s.location} />
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Tablet / desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 font-medium">Employee ID</th>
                    <th className="px-4 py-3 font-medium">Last Active</th>
                    <th className="px-4 py-3 font-medium">Signed In</th>
                    <th className="px-4 py-3 font-medium">Device / IP</th>
                    <th className="px-4 py-3 font-medium">Sign-in Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!sessions &&
                    Array.from({ length: 2 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {sessions?.map((s) => (
                    <tr key={s.sessionId} onClick={() => open(s)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-2 font-medium text-navy">
                          <span className="size-2 rounded-full bg-emerald-500" aria-label="online" />
                          {s.admin.fullName}
                        </p>
                        <p className="pl-4 text-xs text-slate-500">@{s.admin.username}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.admin.employeeId ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-medium text-emerald-700">{ago(s.lastActiveAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(s.signedInAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>{device(s.userAgent)}</p>
                        <p className="text-slate-500">{s.ipAddress || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <LocationLink location={s.location} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sessions && sessions.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <Icon name="users" className="size-6" />
                </span>
                No admins are signed in right now.
                <p className="mt-1 text-xs">
                  Admins appear here as soon as they sign in.{" "}
                  <Link href="/super-admin/admin-management" className="font-medium text-brand hover:underline">
                    View all admins
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
        {updatedAt && !error && (
          <p className="border-t border-slate-100 px-4 py-2 text-right text-xs text-slate-400">
            Updates automatically every 30 seconds · last checked{" "}
            {new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </section>
    </div>
  );
}
