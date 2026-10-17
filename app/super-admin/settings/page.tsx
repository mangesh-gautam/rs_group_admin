import type { Metadata } from "next";
import { SecuritySettings } from "@/components/auth/SecuritySettings";
import { TransactionCorrectionSettings } from "@/components/super-admin/TransactionCorrectionSettings";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <TransactionCorrectionSettings />
      <SecuritySettings breadcrumb="Super Admin · Settings · Security" />
    </div>
  );
}
