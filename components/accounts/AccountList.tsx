"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { useOffices } from "@/lib/offices/useOffices";
import { formatAmount, type AccountPage } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime, officeLabel } from "@/lib/auth/types";

const PAGE_SIZE = 20;

/**
 * All Accounts. The Super Admin sees every office (with an office filter);
 * an Admin sees only accounts opened at their own office (enforced by the API).
 * Clicking a row opens the account.
 */
export function AccountList() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const key = `${q}|${officeId}|${page}|${version}`;
  const [result, setResult] = useState<{ key: string; data: AccountPage | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  // Debounce the search box; a new search starts at page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (officeId) params.set("officeId", officeId);
    authFetch<AccountPage>(`/api/customers/account-holders?${params}`, { signal: controller.signal }).then(
      (data) => setResult({ key, data, error: null }),
      (err) => {
        if ((err as Error).name !== "AbortError") setResult((r) => ({ key, data: r.data, error: errorMessage(err) }));
      },
    );
    return () => controller.abort();
  }, [authFetch, q, officeId, page, key]);

  const loading = result.key !== key;
  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const open = (accountNo: string) => router.push(`/admin/accounts/${accountNo}`);
  const filtered = !!(q || officeId);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">All Accounts</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSuperAdmin
              ? "Every account holder across all offices."
              : user?.office
                ? `Account holders of ${officeLabel(user.office)}.`
                : "You are not assigned to an office yet, so no accounts are shown."}
          </p>
        </div>
        <Link
          href="/admin/open-account"
          className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          <Icon name="plusCircle" className="size-5" /> Open New Account
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <label className="relative w-full min-w-0 flex-1 sm:min-w-60">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, account no., form no., mobile, PAN or Aadhaar…"
              className="h-10 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm"
            />
          </label>
          {isSuperAdmin && (
            <OfficeFilter
              value={officeId}
              onChange={(v) => {
                setOfficeId(v);
                setPage(1);
              }}
            />
          )}
          {data && (
            <span className="text-xs text-slate-500">
              {data.total} account{data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {result.error && result.key === key ? (
          <div className="p-4">
            <Alert tone="error">
              {result.error}{" "}
              <button type="button" onClick={() => setVersion((v) => v + 1)} className="font-medium underline">
                Retry
              </button>
            </Alert>
          </div>
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {loading && !data && <SkeletonItems as="li" />}
              {data?.items.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/accounts/${a.accountNo}`} className="flex items-start gap-3 p-4 active:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{a.name}</p>
                      <p className="font-mono text-xs text-slate-600">{a.accountNo}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        +91 {a.mobileNumber} · {a.city} · {formatAmount(a.balance)}
                      </p>
                    </div>
                    <Icon name="chevronRight" className="mt-2 size-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
              {data && data.items.length === 0 && (
                <li className="px-4 py-12 text-center text-sm text-slate-500">
                  {filtered ? "No accounts match your search." : "No accounts have been opened yet."}
                </li>
              )}
            </ul>

            {/* Tablet / desktop: table */}
            <div className={`hidden overflow-x-auto md:block ${loading && data ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Account No.</th>
                    <th className="px-4 py-3 font-medium">Form No.</th>
                    <th className="px-4 py-3 font-medium">Account Holder</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-medium">Office</th>}
                    <th className="px-4 py-3 font-medium">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && !data && <SkeletonItems as="tr" cols={isSuperAdmin ? 8 : 7} />}
                  {data?.items.map((a) => (
                    <tr
                      key={a.id}
                      tabIndex={0}
                      onClick={() => open(a.accountNo)}
                      onKeyDown={(e) => e.key === "Enter" && open(a.accountNo)}
                      className="cursor-pointer outline-none hover:bg-slate-50/70 focus-visible:bg-brand-soft/60"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-navy">{a.accountNo}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.formNo}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{a.name}</p>
                        {a.fatherHusbandName && <p className="text-xs text-slate-500">C/o {a.fatherHusbandName}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{a.mobileNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{a.city}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatAmount(a.balance)}</td>
                      {isSuperAdmin && <td className="px-4 py-3 text-slate-700">{officeLabel(a.office)}</td>}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDateTime(a.createdAt)}
                        <span className="block text-slate-400">by {a.createdBy}</span>
                      </td>
                    </tr>
                  ))}
                  {data && data.items.length === 0 && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-12 text-center text-sm text-slate-500">
                        {filtered ? "No accounts match your search." : "No accounts have been opened yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data && pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                <span className="text-slate-500">
                  Page {data.page} of {pages}
                </span>
                <div className="flex gap-2">
                  <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </PageButton>
                  <PageButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </PageButton>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function OfficeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { offices } = useOffices();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-brand sm:w-auto sm:text-sm"
      aria-label="Filter by office"
    >
      <option value="">All offices</option>
      {offices?.map((o) => (
        <option key={o.id} value={o.id}>
          {officeLabel(o)}
        </option>
      ))}
    </select>
  );
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SkeletonItems({ as, cols = 1 }: { as: "li" | "tr"; cols?: number }) {
  return Array.from({ length: 4 }, (_, i) =>
    as === "li" ? (
      <li key={i} className="p-4">
        <div className="h-12 animate-pulse rounded bg-slate-100" />
      </li>
    ) : (
      <tr key={i}>
        <td colSpan={cols} className="px-4 py-4">
          <div className="h-5 animate-pulse rounded bg-slate-100" />
        </td>
      </tr>
    ),
  );
}
