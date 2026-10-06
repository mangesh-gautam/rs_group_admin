import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { OpenAccountForm } from "@/components/open-account/OpenAccountForm";
import { StatCards, type Stat } from "@/components/open-account/StatCards";
import {
  QuickActions,
  type QuickAction,
} from "@/components/open-account/QuickActions";
import { PlansTable, type Plan } from "@/components/open-account/PlansTable";
import {
  RecentAccounts,
  type RecentAccount,
} from "@/components/open-account/RecentAccounts";

// ============================================================================
// MOCK DATA — everything this screen renders. Replace each constant with an
// API call later (e.g. `const plans = await getPlans()`), no UI changes needed.
// ============================================================================

const MOCK_PAGE_META = {
  date: "Sep 29, 2026",
  time: "03:25 AM",
};

const MOCK_STATS: Stat[] = [
  {
    label: "Total Members",
    value: "248",
    trend: "12% this month",
    icon: "users",
    tone: "green",
  },
  {
    label: "Total Deposits",
    value: "₹ 24,85,000",
    trend: "18% this month",
    icon: "wallet",
    tone: "blue",
  },
  {
    label: "Total Loans",
    value: "₹ 8,32,000",
    trend: "10% this month",
    icon: "handCoins",
    tone: "orange",
  },
  {
    label: "Pending Approvals",
    value: "7",
    link: { label: "View details", href: "/admin/approvals" },
    icon: "clipboard",
    tone: "purple",
  },
];

const MOCK_QUICK_ACTIONS: QuickAction[] = [
  { label: "Open New Account", href: "/admin/open-account", icon: "plusCircle" },
  { label: "Make Withdrawal", href: "/admin/withdrawals", icon: "upload" },
  { label: "Add Deposit", href: "/admin/deposits", icon: "download" },
  { label: "View All Accounts", href: "/admin/accounts", icon: "users" },
  { label: "Issue Loan", href: "/admin/loans", icon: "handCoins" },
  { label: "Generate Report", href: "/admin/reports/accounts", icon: "fileText" },
];

const MOCK_PLANS: Plan[] = [
  {
    id: "standard",
    name: "Standard",
    interestRate: 0.75,
    lockInMonths: 6,
    minDeposit: 1000,
    maxDeposit: 10000,
    features: ["Safe & Secure", "Flexible"],
  },
  {
    id: "premium",
    name: "Premium",
    interestRate: 1.0,
    lockInMonths: 6,
    minDeposit: 5000,
    maxDeposit: 50000,
    features: ["Higher Interest", "Loan Facility"],
  },
  {
    id: "gold",
    name: "Gold",
    interestRate: 1.25,
    lockInMonths: 6,
    minDeposit: 10000,
    maxDeposit: 100000,
    features: ["Higher Returns", "Priority Support"],
  },
];

const MOCK_RECENT_ACCOUNTS: RecentAccount[] = [
  {
    accountNo: "RS000248",
    name: "Rahul Sharma",
    type: "Standard",
    deposit: 5000,
    status: "Active",
    date: "28 Sep 2026",
  },
  {
    accountNo: "RS000247",
    name: "Priya Patel",
    type: "Premium",
    deposit: 10000,
    status: "Active",
    date: "27 Sep 2026",
  },
  {
    accountNo: "RS000246",
    name: "Amit Kumar",
    type: "Standard",
    deposit: 3000,
    status: "Pending",
    date: "26 Sep 2026",
  },
  {
    accountNo: "RS000245",
    name: "Neha Singh",
    type: "Gold",
    deposit: 20000,
    status: "Active",
    date: "25 Sep 2026",
  },
];

// ============================================================================

export const metadata: Metadata = {
  title: "Open New Account",
};

export default function OpenAccountPage() {
  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft">
            <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
              <Icon name="plus" className="size-6" strokeWidth={2.5} />
            </span>
          </span>
          <div>
            <h1 className="text-2xl font-bold text-navy">Open New Account</h1>
            <p className="text-sm text-slate-600">
              Fill in the Account Holder Registration Form to open a member account.
            </p>
            <Link
              href="/forms/account-holder-registration"
              target="_blank"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <Icon name="fileText" className="size-4" />
              Print blank registration form (A4)
            </Link>
          </div>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p className="flex items-center justify-end gap-2">
            <Icon name="calendar" className="size-4" />
            {MOCK_PAGE_META.date}
            <span className="h-4 w-px bg-slate-300" />
            {MOCK_PAGE_META.time}
          </p>
          <p className="mt-1 flex items-center justify-end gap-1.5">
            <Icon name="home" className="size-3.5" />
            Dashboard
            <Icon name="chevronRight" className="size-3.5 text-slate-400" />
            <span className="text-navy">Open New Account</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <OpenAccountForm />

        <div className="space-y-5">
          <StatCards stats={MOCK_STATS} />
          <QuickActions actions={MOCK_QUICK_ACTIONS} />
          <PlansTable plans={MOCK_PLANS} />
          <RecentAccounts accounts={MOCK_RECENT_ACCOUNTS} />
        </div>
      </div>
    </div>
  );
}
