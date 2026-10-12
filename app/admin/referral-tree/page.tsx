import type { Metadata } from "next";
import { ReferralTree } from "@/components/referral/ReferralTree";

export const metadata: Metadata = {
  title: "Referral Tree",
};

export default async function ReferralTreePage({ searchParams }: PageProps<"/admin/referral-tree">) {
  const { root } = await searchParams;
  return <ReferralTree root={typeof root === "string" && root ? root.toUpperCase() : null} basePath="/admin/referral-tree" />;
}
