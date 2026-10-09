import type { Metadata } from "next";
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { QuickActions } from "@/components/open-account/QuickActions";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <div className="space-y-5">
      <WelcomeBanner />
      <DashboardOverview />
      <QuickActions actions={[
        { label: "Open New Account", href: "/admin/open-account", icon: "plusCircle" },
        { label: "Make Withdrawal", href: "/admin/withdrawals", icon: "upload" },
        { label: "Add Deposit", href: "/admin/deposits", icon: "download" },
        { label: "View All Accounts", href: "/admin/accounts", icon: "users" },
      ]} />
    </div>
  );
}
