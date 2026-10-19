/** Types for the sponsor / referral network and its deposit commission. Amounts are decimal strings. */

export type CommissionType = "PERCENT" | "AMOUNT"; // % of the deposit | fixed ₹ per deposit

export type CommissionLevel = { level: number; type: CommissionType; value: string; active: boolean };

/** GET/PUT /api/deposits/commission-config */
export type CommissionConfig = {
  enabled: boolean;
  includeOpeningDeposit: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  levels: CommissionLevel[]; // levels 1–5
};

/** Row of GET /api/deposits/commissions */
export type CommissionEntry = {
  id: string;
  type: "COMMISSION" | "REVERSAL";
  level: number;
  commissionType: CommissionType;
  rate: string;
  depositAmount: string;
  amount: string; // negative for a reversal
  receiptNo: string; // deposit that generated it
  beneficiary: { accountNo: string; name: string };
  source: { accountNo: string; name: string };
  remarks: string | null;
  at: string;
};

export type CommissionPage = { page: number; pageSize: number; total: number; items: CommissionEntry[]; totalAmount: string };

/** GET /api/customers/sponsors?q= and /sponsors/:accountNo — mobile is masked. */
export type Sponsor = { accountNo: string; name: string; mobile: string; office: { name: string; city: string } };

/** GET /api/customers/account-holders/:accountNo/referral */
export type ReferralSummary = {
  accountNo: string;
  sponsor: { accountNo: string; name: string } | null;
  upline: { level: number; accountNo: string; name: string }[];
  directReferrals: { accountNo: string; name: string; openedAt: string }[];
  networkSize: number; // members up to 5 levels down
  networkByLevel: Record<string, number>;
  commissionEarned: string;
  commissionEarnedCount: number;
  commissionGenerated: string; // paid to the upline by this account's deposits
};

export const LEVEL_LABEL = ["", "Direct sponsor", "Sponsor's sponsor", "Level 3", "Level 4", "Level 5"];

/** "10%" or "₹250" */
export const rateLabel = (type: CommissionType, value: string) =>
  type === "PERCENT" ? `${Number(value)}%` : `₹${Number(value).toLocaleString("en-IN")}`;

/** Commission one level pays on a deposit of `amount` (same rounding as the database). */
export const commissionFor = (l: Pick<CommissionLevel, "type" | "value" | "active">, amount: number) =>
  !l.active ? 0 : l.type === "PERCENT" ? Math.round(amount * Number(l.value)) / 100 : Number(l.value);

/* ---- monthly advisor commission ledger (/api/deposits/advisor-commissions) ---- */

export type PayoutType = "PAYMENT" | "WITHDRAWAL"; // admin pays | advisor withdraws

export const PAYOUT_LABEL: Record<PayoutType | "ADJUSTMENT", string> = {
  PAYMENT: "Commission payment",
  WITHDRAWAL: "Commission withdrawal",
  ADJUSTMENT: "Commission adjustment",
};

type AdvisorRef = { accountNo: string; name: string; mobile: string | null; office: { name: string; city: string | null } };

/** One advisor in one month: NONE (nothing payable) · PENDING · PARTIAL (partly paid) · PAID (in full). */
export type CommissionStatus = "NONE" | "PENDING" | "PARTIAL" | "PAID";

export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; className: string }> = {
  NONE: { label: "Nothing due", className: "bg-slate-50 text-slate-500 ring-slate-200" },
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  PARTIAL: { label: "Partially paid", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

/** Row of GET /advisor-commissions?month=YYYY-MM — one advisor in one month. */
export type CommissionMonthRow = {
  advisor: AdvisorRef;
  opening: string; // closing of the previous month
  earned: string;
  earnedCount: number;
  reversed: string; // ≤ 0: commission taken back (deposit corrected)
  adjusted: string; // ± Super Admin adjustments
  paid: string;
  closing: string;
  status: CommissionStatus;
  available: string; // balance now (all months)
  earnedTotal: string;
  paidTotal: string;
  commissionActive: boolean; // false: the Super Admin stopped new commission
};

export type CommissionOverview = {
  page: number;
  pageSize: number;
  total: number;
  month: string;
  totals: { opening: string; earned: string; reversed: string; adjusted: string; paid: string; closing: string; available: string };
  counts: { pending: number; partial: number; paid: number }; // advisors by status in the month
  items: CommissionMonthRow[];
};

/** GET /advisor-commissions/:accountNo — newest month first. */
/** Super Admin stop / resume of an advisor's NEW commission (earned commission is never touched). */
export type CommissionControl = { active: boolean; changedAt: string | null; changedBy: string | null; reason?: string | null };

export type CommissionStatement = {
  advisor: AdvisorRef;
  available: string;
  commission: CommissionControl;
  months: {
    month: string; opening: string; earned: string; reversed: string; adjusted: string; paid: string; closing: string;
    status: CommissionStatus; earnedCount: number; payoutCount: number;
  }[];
};

/** Row of GET /advisor-commissions/payouts and the result of POST …/:accountNo/payouts. */
export type CommissionPayout = {
  receiptNo: string;
  advisor: { accountNo: string; name: string };
  type: PayoutType | "ADJUSTMENT"; // ADJUSTMENT: Super Admin ± correction (history only)
  replayed?: boolean; // POST answer: this request was already paid — nothing paid again
  month: string;
  amount: string;
  mode: string | null;
  referenceNo: string | null;
  remarks: string | null;
  balanceBefore: string | null;
  balanceAfter: string | null;
  paidAt: string;
  paidBy: string;
};

export type CommissionPayoutPage = { page: number; pageSize: number; total: number; totalAmount: string; items: CommissionPayout[] };

/** "2026-10" → "Oct 2026" */
export const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

/** The current month in India, "YYYY-MM". */
export const currentMonth = () =>
  new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);

/** GET /advisor-commissions/:accountNo/sources — the member accounts whose deposits paid the advisor. */
export type CommissionSource = {
  member: { accountNo: string; name: string };
  via: { accountNo: string; name: string } | null; // who referred that member
  level: number; // 1 = the advisor referred them directly
  entries: number;
  reversals: number;
  depositTotal: string;
  commissionTotal: string;
  firstAt: string;
  lastAt: string;
};
export type CommissionSources = { totalAmount: string; items: CommissionSource[] };

/** Row of GET /advisor-commissions/:accountNo/earned — one deposit → one commission. */
export type EarnedEntry = {
  id: string;
  type: "COMMISSION" | "REVERSAL";
  level: number;
  commissionType: CommissionType;
  rate: string;
  member: { accountNo: string; name: string };
  deposit: { receiptNo: string; amount: string; mode: string; at: string };
  amount: string;
  remarks: string | null;
  at: string;
};
export type EarnedPage = { page: number; pageSize: number; total: number; totalAmount: string; totalDeposits: string; items: EarnedEntry[] };

export const levelLabel = (level: number) => (level === 1 ? "Direct referral" : `Level ${level}`);
