import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdvisorCommissionScreen } from "@/components/referral/AdvisorCommissionScreen";

export const metadata: Metadata = {
  title: "Advisor Commission",
};

export default async function AdvisorCommissionPage({ searchParams }: PageProps<"/super-admin/advisor-commission">) {
  const { advisor, month } = await searchParams;
  // old links (?advisor=RS…) open the advisor's own page
  if (typeof advisor === "string" && advisor) redirect(`/super-admin/advisor-commission/${encodeURIComponent(advisor.toUpperCase())}`);
  return (
    <AdvisorCommissionScreen
      initialMonth={typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null}
      basePath="/super-admin/advisor-commission"
    />
  );
}
