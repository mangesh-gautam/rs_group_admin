import type { Metadata } from "next";
import { AdvisorsScreen } from "@/components/referral/AdvisorsScreen";

export const metadata: Metadata = {
  title: "Advisors",
};

export default async function AdvisorsPage({ searchParams }: PageProps<"/super-admin/advisors">) {
  const { advisor } = await searchParams;
  return (
    <AdvisorsScreen
      initial={typeof advisor === "string" && advisor ? advisor.toUpperCase() : null}
      basePath="/super-admin/advisors"
      treePath="/super-admin/referral-tree"
    />
  );
}
