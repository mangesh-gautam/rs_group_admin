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
