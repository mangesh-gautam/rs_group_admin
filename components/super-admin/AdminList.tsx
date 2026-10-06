"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatDateTime, officeLabel, type AccountStatus } from "@/lib/auth/types";
import { PasswordStateBadge, StatusBadge } from "./AdminBadges";
import { useAdmins } from "./useAdmins";

export function AdminList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AccountStatus | "">("");

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { admins, error, loading, reload } = useAdmins({ status, q });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">Super Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">Admin Management</h1>
          <p className="mt-1 text-sm text-slate-600">View, activate, deactivate and reset admin accounts.</p>
        </div>
        <Link
          href="/super-admin/admin-management/create"
          className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          <Icon name="userPlus" className="size-5" /> Create Admin
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <label className="relative w-full min-w-0 flex-1 sm:min-w-60">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username, email, mobile, ID or office…"
              className="h-10 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-base outline-none sm:text-sm focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus | "")}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-brand sm:w-auto sm:text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>

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
          {/* Phones: one card per admin */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {loading && !admins &&
              Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="p-4">
                  <div className="h-12 animate-pulse rounded bg-slate-100" />
                </li>
              ))}
            {admins?.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/super-admin/admin-management/${a.id}`}
                  className="flex items-start gap-3 p-4 active:bg-slate-50"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {a.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy">{a.fullName}</p>
                    <p className="truncate text-xs text-slate-500">
                      @{a.username} · {a.employeeId ?? "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{officeLabel(a.office)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      +91 {a.mobileNumber}
                      {a.mobileVerified && " · verified"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge admin={a} />
                      <PasswordStateBadge mustChange={a.mustChangePassword} />
                    </div>
                  </div>
                  <Icon name="chevronRight" className="mt-2 size-4 shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
            {admins && admins.length === 0 && (
              <li className="px-4 py-12 text-center text-sm text-slate-500">
                {q || status ? "No admins match your filters." : "No admins have been created yet."}
              </li>
            )}
          </ul>

          {/* Tablet / desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Employee ID</th>
                  <th className="px-4 py-3 font-medium">Office</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Password</th>
                  <th className="px-4 py-3 font-medium">Last Sign-in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !admins &&
                  Array.from({ length: 3 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-5 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))}
                {admins?.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/super-admin/admin-management/${a.id}`)}
                    className="cursor-pointer hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{a.fullName}</p>
                      <p className="text-xs text-slate-500">
                        @{a.username} · {a.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.employeeId ?? "—"}</td>
                    <td className={`px-4 py-3 ${a.office ? "text-slate-700" : "text-slate-400"}`}>{officeLabel(a.office)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.mobileNumber}
                      {a.mobileVerified && (
                        <Icon name="checkCircle" className="ml-1 inline size-3.5 text-emerald-600" aria-label="verified" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge admin={a} />
                    </td>
                    <td className="px-4 py-3">
                      <PasswordStateBadge mustChange={a.mustChangePassword} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(a.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/super-admin/admin-management/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
                {admins && admins.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      {q || status ? "No admins match your filters." : "No admins have been created yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
