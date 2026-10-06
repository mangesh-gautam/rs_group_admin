import type { Metadata } from "next";
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { QuickActions, type QuickAction } from "@/components/open-account/QuickActions";
import { RecentAccounts, type RecentAccount } from "@/components/open-account/RecentAccounts";
import { StatCards, type Stat } from "@/components/open-account/StatCards";

// ============================================================================
// MOCK DATA — dashboard figures (replace with GET /api/admin/dashboard/stats
// and /api/customers/recent later).
// ============================================================================

const MOCK_STATS: Stat[] = [
  { label: "Total Members", value: "248", trend: "12% this month", icon: "users", tone: "green" },
  { label: "Total Deposits", value: "₹ 24,85,000", trend: "18% this month", icon: "wallet", tone: "blue" },
  { label: "Total Loans", value: "₹ 8,32,000", trend: "10% this month", icon: "handCoins", tone: "orange" },
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

const MOCK_RECENT_ACCOUNTS: RecentAccount[] = [
  { accountNo: "RS000248", name: "Rahul Sharma", type: "Standard", deposit: 5000, status: "Active", date: "28 Sep 2026" },
  { accountNo: "RS000247", name: "Priya Patel", type: "Premium", deposit: 10000, status: "Active", date: "27 Sep 2026" },
  { accountNo: "RS000246", name: "Amit Kumar", type: "Standard", deposit: 3000, status: "Pending", date: "26 Sep 2026" },
  { accountNo: "RS000245", name: "Neha Singh", type: "Gold", deposit: 20000, status: "Active", date: "25 Sep 2026" },
];
// ============================================================================

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <div className="space-y-5">
      <WelcomeBanner />
      <StatCards stats={MOCK_STATS} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <QuickActions actions={MOCK_QUICK_ACTIONS} />
        <RecentAccounts accounts={MOCK_RECENT_ACCOUNTS} />
      </div>
    </div>
  );
}
