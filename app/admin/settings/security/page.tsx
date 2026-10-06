import type { Metadata } from "next";
import { SecuritySettings } from "@/components/auth/SecuritySettings";

export const metadata: Metadata = {
  title: "Security Settings",
};

export default function AdminSecurityPage() {
  return <SecuritySettings breadcrumb="Settings / Security" />;
}
