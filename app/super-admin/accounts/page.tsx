import type { Metadata } from "next";
import { AccountList } from "@/components/accounts/AccountList";
export const metadata: Metadata = { title: "All Accounts" };
export default function AllAccountsPage() {
  return <AccountList basePath="/super-admin/accounts" />;
}
