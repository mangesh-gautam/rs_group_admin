import type { Metadata } from "next";
import { ReferralCommissionForm } from "@/components/super-admin/ReferralCommissionForm";

export const metadata: Metadata = {
  title: "Referral Commission",
};

export default function ReferralCommissionPage() {
  return <ReferralCommissionForm />;
}
