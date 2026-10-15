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

export const PAYOUT_LABEL: Record<PayoutType, string> = { PAYMENT: "Commission payment", WITHDRAWAL: "Commission withdrawal" };

type AdvisorRef = { accountNo: string; name: string; mobile: string | null; office: { name: string; city: string | null } };

/** Row of GET /advisor-commissions?month=YYYY-MM — one advisor in one month. */
export type CommissionMonthRow = {
  advisor: AdvisorRef;
  opening: string; // closing of the previous month
  earned: string;
  earnedCount: number;
  paid: string;
  closing: string;
  available: string; // balance now (all months)
  earnedTotal: string;
  paidTotal: string;
};

export type CommissionOverview = {
  page: number;
  pageSize: number;
  total: number;
  month: string;
  totals: { opening: string; earned: string; paid: string; closing: string; available: string };
  items: CommissionMonthRow[];
};

/** GET /advisor-commissions/:accountNo — newest month first. */
export type CommissionStatement = {
  advisor: AdvisorRef;
  available: string;
  months: { month: string; opening: string; earned: string; paid: string; closing: string; earnedCount: number; payoutCount: number }[];
};

/** Row of GET /advisor-commissions/payouts and the result of POST …/:accountNo/payouts. */
export type CommissionPayout = {
  receiptNo: string;
  advisor: { accountNo: string; name: string };
  type: PayoutType;
  month: string;
  amount: string;
  mode: string;
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
