/** Types for advisor ranks and rewards (/api/customers/ranks…). Amounts are decimal strings. */

export type RewardStatus = "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";

export type Reward = { title: string; value: string | null; description?: string | null };

/** GET /api/customers/ranks */
export type Rank = {
  id: number;
  code: string;
  name: string;
  target: number; // accounts a member must open
  reward: Reward;
  isActive: boolean;
  achievedCount: number;
  updatedAt: string;
  updatedBy: string | null;
};

/** Row of GET /api/customers/ranks/advisors */
export type RankProgressRow = {
  member: { accountNo: string; name: string; mobileNumber: string; office: { name: string; city: string } };
  accountsOpened: number;
  excluded: number;
  lastOpenedAt: string | null;
  currentRank: { code: string; name: string; achievedAt: string } | null;
  nextRank: { code: string; name: string; target: number; remaining: number } | null;
  pendingRewards: number;
};

export type RankProgressPage = { page: number; pageSize: number; total: number; items: RankProgressRow[] };

/** GET /api/customers/ranks/advisors/:accountNo (admin) — also the shape of /api/member/ranks */
export type RankSummary = {
  advisor?: { accountNo: string; name: string; mobileNumber: string; status: string };
  accountsOpened: number;
  excluded: number;
  currentRank: { code: string; name: string; achievedAt: string } | null;
  nextRank: { code: string; name: string; target: number; remaining: number; reward: string } | null;
  ranks: {
    code: string; name: string; target: number; reward: Reward;
    achieved: boolean; achievedAt: string | null; rewardStatus: RewardStatus | null; remaining: number; progress: number;
  }[];
  promotions: {
    id: number; rank: { code: string; name: string }; achievedAt: string; accountsAtPromotion: number; target: number;
    reward: Reward; rewardStatus: RewardStatus; note: string | null;
    approvedAt: string | null; deliveredAt: string | null; cancelledAt: string | null;
  }[];
  accounts: {
    accountNo: string; name: string; openedAt: string; counted: boolean; excludedReason: string | null; accountStatus: string;
    excludedAt?: string | null; excludedBy?: string | null; office?: string;
  }[];
};

/** Row of GET /api/customers/ranks/promotions */
export type Promotion = {
  id: number;
  achievedAt: string;
  accountsAtPromotion: number;
  target: number;
  rank: { code: string; name: string };
  member: { accountNo: string; name: string; mobileNumber: string; office: string };
  reward: Reward;
  rewardStatus: RewardStatus;
  note: string | null;
  approvedAt: string | null; approvedBy: string | null;
  deliveredAt: string | null; deliveredBy: string | null;
  cancelledAt: string | null; cancelledBy: string | null;
};

export type PromotionPage = {
  page: number; pageSize: number; total: number; items: Promotion[];
  counts: { pending: number; approved: number; delivered: number; cancelled: number };
};

export const REWARD_STATUS: Record<RewardStatus, { label: string; className: string }> = {
  PENDING: { label: "Reward pending", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  APPROVED: { label: "Approved", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

/** "Watch", or "Mobile (₹15,000)" when a value is set — the value only when it adds something. */
export const rewardLabel = (r: Reward) =>
  r.value && !r.title.includes("₹") ? `${r.title} (₹${Number(r.value).toLocaleString("en-IN")})` : r.title;

export const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
