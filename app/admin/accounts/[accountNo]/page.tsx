import type { Metadata } from "next";
import { AccountView } from "@/components/accounts/AccountView";

export const metadata: Metadata = {
  title: "Account Details",
};

export default async function AccountDetailPage({ params }: PageProps<"/admin/accounts/[accountNo]">) {
  const { accountNo } = await params;
  return <AccountView accountNo={accountNo} />;
}
