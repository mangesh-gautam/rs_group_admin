import type { Metadata } from "next";
import { RanksScreen } from "@/components/ranks/RanksScreen";

export const metadata: Metadata = {
  title: "Ranks & Rewards",
};

export default function RanksPage() {
  return <RanksScreen basePath="/super-admin/ranks" />;
}
