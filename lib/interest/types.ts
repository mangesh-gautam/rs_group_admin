/** Types for the interest-service API (/api/interest). Amounts are decimal strings. */

import type { AccountType } from "@/lib/deposits/types";

/** One closed month: previous balance → deposits − withdrawals → interest → closing balance. */
export type MonthlyInterest = {
  month: string; // YYYY-MM-01
  previousBalance: string;
  deposits: string;
  withdrawals: string;
  interestBase: string; // month-end balance the interest is calculated on
  rate: string; // % per month
  interest: string;
  closingBalance: string;
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
  totalInterest: string;
  currentMonth: {
    month: string;
    deposits: string;
    withdrawals: string;
    balance: string;
    estimatedInterest: string; // if nothing else changes this month
  };
  months: MonthlyInterest[]; // newest first
};

/** "Oct 2026" */
export const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
