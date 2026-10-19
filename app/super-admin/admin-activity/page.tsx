import type { Metadata } from "next";
import { AdminActivityScreen } from "@/components/activity/AdminActivityScreen";

export const metadata: Metadata = {
  title: "Admin Activity",
};

export default function AdminActivityPage() {
  return <AdminActivityScreen basePath="/super-admin/admin-activity" />;
}
