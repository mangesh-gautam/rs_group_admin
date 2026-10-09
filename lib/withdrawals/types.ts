/** Types for the withdrawal-service API (/api/withdrawals). Amounts are decimal strings. */
import type { DepositMode } from "@/lib/deposits/types";

export type PaymentMode = DepositMode; // same modes for paying out: CASH | UPI | CHEQUE | BANK_TRANSFER

/**
 * NORMAL: the deposit cycle is complete (duration, a deposit every month or
 * the missed-month penalty paid, nothing outstanding) — paid in full.
 * EARLY: otherwise — 20 % of the amount is deducted from what is paid out.
 * No withdrawal at all while a missed-month penalty is outstanding.
 */
export type WithdrawalType = "NORMAL" | "EARLY";

/** GET/PUT /api/withdrawals/rules — set by the Super Admin, enforced by the backend. */
export type WithdrawalRules = {
  minDurationMonths: number;
  durationEnabled: boolean;
  monthlyDepositEnabled: boolean;
  missedPenaltyEnabled: boolean;
  missedMonthPenalty: string; // ₹ per missed month
  earlyPenaltyRate: string; // % deducted from an early withdrawal
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DepositMonthStatus = "PAID" | "MISSED" | "PENDING";

/** The current deposit cycle of an account (from the first deposit, or the last withdrawal). */
export type DepositCycle = {
  startOn: string; // YYYY-MM-DD
  startsFrom: "FIRST_DEPOSIT" | "LAST_WITHDRAWAL";
  endOn: string;
  durationMonths: number;
  eligibleOn: string; // startOn + durationMonths
  completedMonths: number;
  missedMonths: number;
  pendingMonths: number;
  penaltyPerMonth: string;
  totalPenalty: string;
  penaltyPaid: string;
  outstandingPenalty: string;
  durationMet: boolean;
  monthlyMet: boolean;
  penaltyMet: boolean;
  normalEligible: boolean;
  reasons: string[]; // why a normal withdrawal isn't available
  months: { monthNo: number; month: string; status: DepositMonthStatus; depositCount: number; depositTotal: string }[];
};

/** GET /api/withdrawals/accounts/:accountNo */
export type WithdrawalAccount = {
  accountNo: string;
  name: string;
  fatherHusbandName: string | null;
  mobileNumber: string;
  city: string;
  office: { name: string; city: string };
  photo: string; // data URL
  balance: string; // available to withdraw = principalBalance + accruedInterest
  principalBalance: string;
  accruedInterest: string; // month-end interest since the last withdrawal
  totalDeposited: string;
  totalWithdrawn: string;
  totalInterest: string;
  withdrawalCount: number;
  lastWithdrawalAt: string | null;
  lastWithdrawalOn: string | null; // YYYY-MM-DD
  nextWithdrawalOn: string | null; // next normal (no deduction) withdrawal date; null = never withdrawn
  today: string; // YYYY-MM-DD (server, Asia/Kolkata)
  withdrawalToday: {
    type: WithdrawalType;
    penaltyRate: string; // "0.00" | "20.00" (% of the amount)
    allowed: boolean; // false while a missed-month penalty is outstanding
    reasons: string[];
    eligibleFrom: string | null;
    daysUntilNormal: number;
  };
  cycle: DepositCycle | null; // null: no successful deposit yet
  rules: WithdrawalRules;
};

/** GET /api/withdrawals/accounts/:accountNo/cycle — the same without the photo. */
export type AccountCycleStatus = Omit<WithdrawalAccount, "photo">;

/** The calculation of a withdrawal — part of the receipt and of every history row. */
type WithdrawalCalculation = {
  type: WithdrawalType;
  amount: string; // debited from the account (full requested amount)
  penaltyRate: string;
  penalty: string; // early-withdrawal deduction
  netAmount: string; // paid to the holder = amount − penalty
  principalBefore: string;
  interestBefore: string;
  balanceBefore: string; // principalBefore + interestBefore
  previousWithdrawalOn: string | null;
  eligibleFrom: string | null;
  nextWithdrawalOn: string; // this withdrawal's date + configured duration
  // the deposit cycle this withdrawal closed (null for withdrawals before the cycle rules)
  cycleStartOn: string | null;
  durationMonths: number | null;
  completedMonths: number | null;
  missedMonths: number | null;
  cyclePenalty: string | null;
  cyclePenaltyPaid: string | null;
};

/** POST /api/withdrawals → 201 */
export type WithdrawalReceipt = WithdrawalCalculation & {
  receiptNo: string; // WDL00000001 …
  accountNo: string;
  name: string;
  mode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  balance: string; // balance after this withdrawal
  withdrawnAt: string;
  createdBy: string;
};

/** Row of GET /api/withdrawals */
export type WithdrawalEntry = WithdrawalCalculation & {
  receiptNo: string;
  accountNo: string;
  name: string;
  balanceAfter: string;
  mode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  office: { name: string; city: string };
  withdrawnAt: string;
  createdBy: string;
};

export type WithdrawalPage = { page: number; pageSize: number; total: number; items: WithdrawalEntry[] };

/** POST /api/withdrawals/penalties → 201 (separate from deposits; the balance is not touched) */
export type PenaltyReceipt = {
  receiptNo: string; // PEN00000001 …
  accountNo: string;
  name: string;
  amount: string;
  mode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  cycleStartOn: string;
  missedMonths: number;
  penaltyPerMonth: string;
  outstandingBefore: string;
  outstandingAfter: string;
  paidAt: string;
  createdBy: string;
};

/** GET /api/withdrawals/accounts/:accountNo/quote?amount= — the server's calculation, nothing saved. */
export type WithdrawalQuote = {
  accountNo: string;
  name: string;
  type: WithdrawalType;
  reasons: string[]; // why it is EARLY (empty for NORMAL)
  amount: string; // debited from the account
  penaltyRate: string;
  penalty: string; // early-withdrawal deduction
  netAmount: string; // paid to the holder
  principalBefore: string;
  interestBefore: string;
  balanceBefore: string;
  balanceAfter: string;
  withdrawalOn: string;
  previousWithdrawalOn: string | null;
  eligibleFrom: string | null; // normal withdrawal date of the current cycle
  nextWithdrawalOn: string; // next cycle's normal withdrawal date, if this one goes ahead
  cycleStartOn: string | null;
  durationMonths: number | null;
  completedMonths: number | null;
  missedMonths: number | null;
};
