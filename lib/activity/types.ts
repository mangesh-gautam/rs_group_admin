import { useEffect, useState } from "react";

/** Admin Activity (Super Admin only) — GET /api/admin/activity/*. Dates are IST. */

export type ActivityAdmin = { id: number; name: string; username: string; employeeId: string | null; status: string };

export type ActivityBlock = {
  transactions: number;
  deposits: { count: number; amount: string };
  withdrawals: { count: number; amount: string };
  accountsCreated: number;
};

export type AdminActivityRow = {
  admin: ActivityAdmin & {
    role: "ADMIN" | "SUPER_ADMIN";
    office: { name: string; city: string | null } | null;
    lastLoginAt: string | null;
  };
  day: ActivityBlock;
  month: ActivityBlock;
  allTime: { transactions: number; deposits: number; withdrawals: number; accountsCreated: number; lastTransactionAt: string | null };
};

type Totals = { transactions: number; depositAmount: string; withdrawalAmount: string; accountsCreated: number };
export type AdminActivityPage = {
  page: number;
  pageSize: number;
  total: number;
  day: string;
  month: string;
  totals: { day: Totals; month: Totals };
  items: AdminActivityRow[];
};

export type TxnStatus = "SUCCESS" | "PENDING" | "FAILED" | "CANCELLED" | "REVERSED";
export type ActivityTransaction = {
  transactionId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  kind: string; // DEPOSIT | OPENING · NORMAL | EARLY
  account: { accountNo: string; holderName: string };
  amount: string;
  netAmount: string;
  mode: string;
  status: TxnStatus;
  at: string;
  admin: ActivityAdmin;
  recordedBy: string;
  office: { name: string; city: string | null };
};
export type ActivityTransactionPage = {
  page: number;
  pageSize: number;
  total: number;
  totals: {
    transactions: number;
    deposits: { count: number; amount: string };
    withdrawals: { count: number; amount: string };
    notSuccessful: number;
  };
  items: ActivityTransaction[];
};

export type ActivityAccount = {
  account: { accountNo: string; holderName: string; status: string; kycStatus: string };
  openingAmount: string;
  createdAt: string;
  admin: ActivityAdmin;
  recordedBy: string;
  office: { name: string; city: string | null };
};
export type ActivityAccountPage = { page: number; pageSize: number; total: number; items: ActivityAccount[] };

export type ActivityPeriod = ActivityBlock & { period: string };

export const TXN_STATUS: Record<TxnStatus, { label: string; cls: string }> = {
  SUCCESS: { label: "Success", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  FAILED: { label: "Failed", cls: "bg-red-50 text-red-700 ring-red-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  REVERSED: { label: "Reversed", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
};

export const txnLabel = (t: Pick<ActivityTransaction, "type" | "kind">) =>
  t.type === "DEPOSIT" ? (t.kind === "OPENING" ? "Opening deposit" : "Deposit") : t.kind === "EARLY" ? "Withdrawal (early)" : "Withdrawal";

// ---- IST dates (whatever the browser's own time zone is) ----------------------------------
const IST = "Asia/Kolkata";
export const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: IST }); // YYYY-MM-DD
export const istMonth = () => istToday().slice(0, 7);
export const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "short", year: "numeric" });
export const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const dayLabel = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric" });
export const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
/** Last day of a "YYYY-MM" month as YYYY-MM-DD. */
export const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** The value, settled for `ms` (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Saves rows as an Excel-friendly CSV (UTF-8 with BOM). */
export function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const url = URL.createObjectURL(new Blob([`﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
