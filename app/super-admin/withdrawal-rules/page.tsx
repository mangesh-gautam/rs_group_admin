import type { Metadata } from "next";
import { WithdrawalRulesForm } from "@/components/super-admin/WithdrawalRulesForm";

export const metadata: Metadata = {
  title: "Withdrawal Rules",
};

export default function WithdrawalRulesPage() {
  return <WithdrawalRulesForm />;
}
