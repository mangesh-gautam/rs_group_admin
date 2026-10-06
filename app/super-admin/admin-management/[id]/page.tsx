import type { Metadata } from "next";
import { AdminDetail } from "@/components/super-admin/AdminDetail";

export const metadata: Metadata = {
  title: "Admin Details",
};

export default async function AdminDetailPage({
  params,
}: PageProps<"/super-admin/admin-management/[id]">) {
  const { id } = await params;
  return <AdminDetail id={id} />;
}
