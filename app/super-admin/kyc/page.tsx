import type { Metadata } from "next";
import { KycList } from "@/components/kyc/KycList";

export const metadata: Metadata = {
  title: "KYC Verification",
};

export default function KycPage() {
  return <KycList />;
}
