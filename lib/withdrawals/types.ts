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

/** CLOSURE: the final settlement of an account closed by an Admin (history only). */
export type WithdrawalEntryType = WithdrawalType | "CLOSURE";

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

/** PAID · PENDING (not due) · GRACE (due, inside the buffer: no fine yet) · MISSED (due + buffer passed: fined) */
export type DepositMonthStatus = "PAID" | "PENDING" | "GRACE" | "MISSED";

/**
 * The active deposit cycle of an account. It starts with an actual deposit
 * (the first one, or the first after a withdrawal) and ends with a withdrawal
 * or the account's closure; no deposit is expected and no penalty arises
 * between a withdrawal and the next deposit.
 */
export type DepositCycle = {
  startOn: string; // YYYY-MM-DD
  startsFrom: "FIRST_DEPOSIT" | "DEPOSIT_AFTER_WITHDRAWAL" | "DEPOSIT_AFTER_CLOSURE";
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
  months: { monthNo: number; month: string; dueOn: string; payBy: string; status: DepositMonthStatus; depositCount: number; depositTotal: string }[];
};

/** GET /api/withdrawals/accounts/:accountNo */
export type WithdrawalAccount = {
  accountNo: string;
  name: string;
  fatherHusbandName: string | null;
  mobileNumber: string;
  city: string;
  office: { name: string; city: string };
  photo: string | null; // data URL; null = no photo (optional at opening)
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
    allowed: boolean; // false when closed, KYC not verified or a missed-month penalty is outstanding
    reasons: string[];
    eligibleFrom: string | null;
    daysUntilNormal: number;
  };
  status: "ACTIVE" | "CLOSED";
  closedOn: string | null; // YYYY-MM-DD
  /** ACTIVE · INACTIVE: withdrawn, no deposit since (nothing expected, no penalty) · NOT_STARTED · CLOSED */
  cycleState: "ACTIVE" | "INACTIVE" | "NOT_STARTED" | "CLOSED";
  cycle: DepositCycle | null; // null: no active cycle (see cycleState)
  rules: WithdrawalRules;
  kyc: { status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED"; verified: boolean }; // only VERIFIED can withdraw
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
export type WithdrawalEntry = Omit<WithdrawalCalculation, "type"> & {
  type: WithdrawalEntryType;
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

/** Why an account can't be closed yet (GET …/closure → blockers). */
export type ClosureBlocker = {
  code: "ACTIVE_CYCLE" | "BALANCE" | "PENALTY" | "PENDING_DEPOSIT" | "COMMISSION" | "INTEREST";
  message: string;
};

/** The withdrawal that settled an account before it was closed. */
export type ClosureSettlementWithdrawal = {
  receiptNo: string | null; // WDL…
  type: "NORMAL" | "EARLY" | "CLOSURE";
  amount: string; // balance taken out
  deduction: string; // early-settlement deduction (0 for NORMAL)
  netAmount: string; // paid to the holder
  settledAt: string;
};

/** Row of GET /api/withdrawals/closures */
export type ClosureEntry = {
  accountNo: string;
  name: string;
  closedAt: string;
  closedBy: string;
  reason: string;
  remarks: string | null;
  settlement: ClosureSettlementWithdrawal | null;
  /** closures before the settle-first rule paid out themselves */
  legacyPayout: { payable: string; mode: string | null; withdrawalReceiptNo: string | null } | null;
  office: { name: string; city: string };
};

/**
 * GET /api/withdrawals/accounts/:accountNo/closure — an account is closed only
 * after a full settlement (the complete balance withdrawn at the desk).
 */
export type ClosureQuote = {
  accountNo: string;
  name: string;
  status: "ACTIVE" | "CLOSED";
  closedOn: string | null;
  today: string;
  canClose: boolean;
  blockers: ClosureBlocker[];
  balance: { principal: string; accruedInterest: string; total: string; commission: string; outstandingPenalty: string };
  cycle: { startOn: string; eligibleOn: string; missedMonths: number } | null;
  /** the full-balance withdrawal that settles it today (null: nothing left to settle) */
  settlement: { type: "NORMAL" | "EARLY"; amount: string; deductionRate: string; deduction: string; payable: string } | null;
  closure: ClosureEntry | null;
};

/** POST /api/withdrawals/accounts/:accountNo/close → 201 */
export type ClosureReceipt = {
  accountNo: string;
  name: string;
  status: "CLOSED";
  closedAt: string;
  closedBy: string;
  reason: string;
  remarks: string | null;
  settlement: ClosureSettlementWithdrawal | null;
};
