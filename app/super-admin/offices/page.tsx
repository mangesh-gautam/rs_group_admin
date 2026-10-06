import type { Metadata } from "next";
import { OfficeManagement } from "@/components/super-admin/OfficeManagement";

export const metadata: Metadata = {
  title: "Offices",
};

export default function OfficesPage() {
  return <OfficeManagement />;
}
