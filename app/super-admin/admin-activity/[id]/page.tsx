import type { Metadata } from "next";
import { AdminActivityDetail } from "@/components/activity/AdminActivityDetail";

export const metadata: Metadata = {
  title: "Admin Activity",
};

export default async function AdminActivityDetailPage({ params }: PageProps<"/super-admin/admin-activity/[id]">) {
  const { id } = await params;
  return <AdminActivityDetail id={id} basePath="/super-admin/admin-activity" />;
}
