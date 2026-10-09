import Link from "next/link";
import type { Metadata } from "next";
import { AccountTransactions } from "@/components/accounts/AccountTransactions";
export const metadata: Metadata = { title: "Account Transactions" };
export default async function AccountTransactionsPage({ params }: { params: Promise<{ accountNo: string }> }) {
  const { accountNo } = await params;
  return <div className="mx-auto max-w-7xl space-y-5">
    <Link href="/super-admin/accounts" className="text-sm text-brand">← All Accounts</Link>
    <h1 className="break-words text-2xl font-bold text-navy">Account {accountNo}</h1>
    <AccountTransactions accountNo={accountNo} />
  </div>;
}
