/** Types for the interest-service API (/api/interest). Amounts are decimal strings. */

import type { AccountType } from "@/lib/deposits/types";

/**
 * One closed month. PRINCIPAL rows (simple interest): previous principal +
 * deposits − principal withdrawn = month-end principal; interest on it;
 * accrued interest = all interest held; closing = principal + accrued interest.
 * BALANCE rows: months closed before migration 022 (interest on the whole balance).
 */
export type MonthlyInterest = {
  month: string; // YYYY-MM-01
  previousBalance: string;
  deposits: string;
  withdrawals: string;
  interestBase: string; // month-end principal the interest is calculated on
  rate: string; // % per month
  interest: string;
  accruedInterest: string | null; // interest held after this month (null for BALANCE rows)
  closingBalance: string;
  interestBasis: "PRINCIPAL" | "BALANCE";
  receiptNo: string | null; // DEP… of the interest credit (none when 0)
  postedAt: string;
};

/** GET /api/interest/accounts/:accountNo */
export type AccountInterest = {
  accountNo: string;
  name: string;
  accountType: AccountType;
  interestRate: string;
  interestFrom: string; // first month settled at month end
  balance: string;
  principal: string; // earns the interest
  accruedInterest: string; // credited, not withdrawn
  totalInterest: string;
  currentMonth: {
    month: string;
    deposits: string;
    withdrawals: string;
    balance: string;
    principal: string;
    accruedInterest: string;
    estimatedInterest: string; // on the principal, if nothing else changes this month
  };
  months: MonthlyInterest[]; // newest first
};

/** "Oct 2026" */
export const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
