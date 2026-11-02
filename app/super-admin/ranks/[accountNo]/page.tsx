import type { Metadata } from "next";
import { AdvisorRankDetail } from "@/components/ranks/AdvisorRankDetail";

export const metadata: Metadata = {
  title: "Ranks & Rewards",
};

export default async function AdvisorRankPage({ params }: PageProps<"/super-admin/ranks/[accountNo]">) {
  const { accountNo } = await params;
  return <AdvisorRankDetail accountNo={accountNo} listPath="/super-admin/ranks" accountsPath="/super-admin/accounts" />;
}
