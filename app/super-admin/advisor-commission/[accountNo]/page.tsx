import type { Metadata } from "next";
import { AdvisorCommissionPage } from "@/components/referral/AdvisorCommissionDetail";

export const metadata: Metadata = {
  title: "Advisor Commission",
};

export default async function AdvisorCommissionDetailPage({ params, searchParams }: PageProps<"/super-admin/advisor-commission/[accountNo]">) {
  const { accountNo } = await params;
  const { month } = await searchParams;
  return (
    <AdvisorCommissionPage
      accountNo={accountNo}
      month={typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null}
      listPath="/super-admin/advisor-commission"
      advisorsPath="/super-admin/advisors"
    />
  );
}
