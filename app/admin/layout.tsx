import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminHeader } from "@/components/shell/AdminHeader";
import { AdminSidebar, type NavSection } from "@/components/shell/AdminSidebar";
import { MobileNavProvider } from "@/components/shell/MobileNav";

// ============================================================================
// MOCK DATA — nav config + notification count (replace with API data later).
// The signed-in user comes from the auth session (useAuth), not from here.
// ============================================================================

const MOCK_NOTIFICATION_COUNT = 3;

const MOCK_NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/admin/dashboard", icon: "home" }],
  },
  {
    title: "Account Management",
    items: [
      { label: "Open New Account", href: "/admin/open-account", icon: "plusCircle" },
      { label: "All Accounts", href: "/admin/accounts", icon: "users" },
      { label: "KYC Verification", href: "/admin/kyc", icon: "shieldCheck" },
      { label: "Advisors", href: "/admin/advisors", icon: "handCoins" },
      { label: "Advisor Commission", href: "/admin/advisor-commission", icon: "wallet" },
      { label: "Ranks & Rewards", href: "/admin/ranks", icon: "crown" },
      { label: "Referral Tree", href: "/admin/referral-tree", icon: "users" },
      { label: "Account Approvals", href: "/admin/approvals", icon: "checkCircle" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Deposits", href: "/admin/deposits", icon: "download" },
      { label: "Withdrawals", href: "/admin/withdrawals", icon: "upload" },
      { label: "Loans", href: "/admin/loans", icon: "handCoins" },
      { label: "Interest & Rewards", href: "/admin/rewards", icon: "gift" },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Account Reports", href: "/admin/reports/accounts", icon: "fileText" },
      { label: "Transaction Reports", href: "/admin/reports/transactions", icon: "barChart" },
      { label: "Financial Summary", href: "/admin/reports/financial-summary", icon: "pieChart" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "My Profile", href: "/admin/profile", icon: "userCircle" },
      { label: "Security", href: "/admin/settings/security", icon: "lock" },
    ],
  },
];
// ============================================================================

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // ADMIN area. The Super Admin may also open it (header → Admin Panel).
    <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
      <MobileNavProvider>
        {/* relative + overflow-clip: nothing inside (e.g. a hidden file input that gets focus) can make
            the page taller or scroll it — only <main> and the sidebar scroll */}
        <div className="relative flex h-dvh flex-col overflow-clip print:h-auto print:overflow-visible">
          <AdminHeader notificationCount={MOCK_NOTIFICATION_COUNT} />
          <div className="flex min-h-0 flex-1 overflow-hidden print:overflow-visible">
            <AdminSidebar sections={MOCK_NAV_SECTIONS} />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain print:overflow-visible p-3 sm:p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </RequireAuth>
  );
}
