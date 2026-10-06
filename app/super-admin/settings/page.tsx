import type { Metadata } from "next";
import { SecuritySettings } from "@/components/auth/SecuritySettings";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SuperAdminSettingsPage() {
  return <SecuritySettings breadcrumb="Super Admin · Settings · Security" />;
}
