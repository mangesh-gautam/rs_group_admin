import { RequireAuth } from "@/components/auth/RequireAuth";
import { MobileNavProvider } from "@/components/shell/MobileNav";
import { SuperAdminHeader } from "@/components/super-admin/SuperAdminHeader";
import {
  SuperAdminSidebar,
  type SuperAdminNavItem,
} from "@/components/super-admin/SuperAdminSidebar";

// ============================================================================
// Static nav config. The signed-in user comes from the auth session.
// ============================================================================

const SUPER_ADMIN_NAV: SuperAdminNavItem[] = [
  { label: "Dashboard", href: "/super-admin/dashboard", icon: "home" },
  { label: "All Accounts", href: "/super-admin/accounts", icon: "users" },
  { label: "KYC Verification", href: "/super-admin/kyc", icon: "shieldCheck" },
  { label: "Admin Management", href: "/super-admin/admin-management", icon: "users" },
  { label: "Active Sessions", href: "/super-admin/active-sessions", icon: "zap" },
  { label: "Offices", href: "/super-admin/offices", icon: "house" },
  { label: "Withdrawal Rules", href: "/super-admin/withdrawal-rules", icon: "calendar" },
  { label: "Referral Commission", href: "/super-admin/referral-commission", icon: "handCoins" },
  { label: "Advisors", href: "/super-admin/advisors", icon: "handCoins" },
  { label: "Advisor Commission", href: "/super-admin/advisor-commission", icon: "wallet" },
  { label: "Referral Tree", href: "/super-admin/referral-tree", icon: "users" },
  { label: "Create Admin", href: "/super-admin/admin-management/create", icon: "userPlus" },
  { label: "Settings", href: "/super-admin/settings", icon: "settings" },
];

const SIDEBAR_NOTICE = {
  title: "Super Admin Access Only",
  body: "This section is restricted to the Super Admin. Every action here is recorded in the audit log.",
};
// ============================================================================

export default function SuperAdminLayout({ children }: LayoutProps<"/super-admin">) {
  return (
    <RequireAuth roles={["SUPER_ADMIN"]}>
      <MobileNavProvider>
        {/* relative + overflow-clip: nothing inside (e.g. a hidden file input that gets focus) can make
            the page taller or scroll it — only <main> and the sidebar scroll */}
        <div className="relative flex h-dvh flex-col overflow-clip print:h-auto print:overflow-visible">
          <SuperAdminHeader />
          <div className="flex min-h-0 flex-1 overflow-hidden print:overflow-visible">
            <SuperAdminSidebar items={SUPER_ADMIN_NAV} notice={SIDEBAR_NOTICE} />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain print:overflow-visible bg-gradient-to-br from-[#f4f7fc] to-[#eef3fb] p-3 sm:p-4 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </MobileNavProvider>
    </RequireAuth>
  );
}
