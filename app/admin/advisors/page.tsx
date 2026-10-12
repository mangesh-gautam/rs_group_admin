import type { Metadata } from "next";
import { AdvisorsScreen } from "@/components/referral/AdvisorsScreen";

export const metadata: Metadata = {
  title: "Advisors",
};

export default async function AdvisorsPage({ searchParams }: PageProps<"/admin/advisors">) {
  const { advisor } = await searchParams;
  return (
    <AdvisorsScreen
      initial={typeof advisor === "string" && advisor ? advisor.toUpperCase() : null}
      basePath="/admin/advisors"
      treePath="/admin/referral-tree"
    />
  );
}
