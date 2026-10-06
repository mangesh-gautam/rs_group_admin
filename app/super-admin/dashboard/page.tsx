import type { Metadata } from "next";
import { SuperAdminDashboard } from "@/components/super-admin/SuperAdminDashboard";

export const metadata: Metadata = {
  title: "Super Admin Dashboard",
};

export default function SuperAdminDashboardPage() {
  return <SuperAdminDashboard />;
}
