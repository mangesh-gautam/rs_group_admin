"use client";

import Link from "next/link";
import { Alert } from "@/components/auth/FormControls";
import { Icon, type IconName } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { PasswordStateBadge, StatusBadge } from "./AdminBadges";
import { useActiveSessions } from "./useActiveSessions";
import { useAdmins } from "./useAdmins";
import { DashboardOverview } from "@/components/admin/DashboardOverview";

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const { admins, error, loading, reload } = useAdmins();
  const { sessions } = useActiveSessions();

  const list = admins ?? [];
  const onlineAdmins = new Set(sessions?.map((s) => s.admin.id)).size;
  const stats: { label: string; value: number | null; icon: IconName; tone: string; href?: string; hint?: string }[] = [
    {
      label: "Active Sessions",
      value: sessions ? onlineAdmins : null,
      icon: "zap",
      tone: "bg-emerald-600",
      href: "/super-admin/active-sessions",
      hint: "Signed in right now · view who",
    },
    { label: "Total Admins", value: list.length, icon: "users", tone: "bg-brand" },
    { label: "Active", value: list.filter((a) => a.status === "ACTIVE").length, icon: "checkCircle", tone: "bg-emerald-500" },
    {
      label: "Inactive / Locked",
      value: list.filter((a) => a.status !== "ACTIVE" || a.temporarilyLocked).length,
      icon: "lock",
      tone: "bg-slate-500",
    },
    {
      label: "Pending Password Change",
      value: list.filter((a) => a.mustChangePassword).length,
      icon: "clipboard",
      tone: "bg-amber-500",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">Super Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">Welcome, {user?.fullName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-600">Manage who can access the RS Group Society admin panel.</p>
        </div>
        <Link
          href="/super-admin/admin-management/create"
          className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          <Icon name="userPlus" className="size-5" /> Create Admin
        </Link>
      </div>

      {error && (
        <Alert tone="error">
          {error}{" "}
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => {
          const body = (
            <>
              <span className="flex items-center justify-between">
                <span className={`grid size-9 place-items-center rounded-full text-white ${s.tone}`}>
                  <Icon name={s.icon} className="size-4" />
                </span>
                {s.href && !!s.value && (
                  <span className="relative inline-flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                  </span>
                )}
              </span>
              <p className="mt-3 text-xs font-medium text-slate-600">{s.label}</p>
              <p className="mt-0.5 text-2xl font-bold text-navy">
                {s.value === null || (loading && !admins) ? (
                  <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-100" />
                ) : (
                  s.value
                )}
              </p>
              {s.hint && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brand">
                  {s.hint} <Icon name="arrowRight" className="size-3.5" />
                </p>
              )}
            </>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl border border-emerald-200 bg-white p-4 transition hover:border-emerald-400 hover:shadow-md sm:p-5"
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              {body}
            </div>
          );
        })}
      </div>

      <DashboardOverview />

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <Icon name="users" className="size-5 text-brand" /> Recently created admins
          </h2>
          <Link
            href="/super-admin/admin-management"
            className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <span className="sm:hidden">View all</span>
            <span className="hidden sm:inline">Admin Management</span>
            <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
        {!loading && list.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No admins yet.{" "}
            <Link href="/super-admin/admin-management/create" className="font-medium text-brand hover:underline">
              Create the first admin
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/super-admin/admin-management/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50/60"
                >
                  <div>
                    <p className="text-sm font-medium text-navy">{a.fullName}</p>
                    <p className="text-xs text-slate-500">
                      @{a.username} · {a.employeeId ?? "—"} · created {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PasswordStateBadge mustChange={a.mustChangePassword} />
                    <StatusBadge admin={a} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
