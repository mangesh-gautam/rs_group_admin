import type { Metadata } from "next";
import { AdminList } from "@/components/super-admin/AdminList";

export const metadata: Metadata = {
  title: "Admin Management",
};

export default function AdminManagementPage() {
  return <AdminList />;
}
