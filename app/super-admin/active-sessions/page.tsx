import type { Metadata } from "next";
import { ActiveSessions } from "@/components/super-admin/ActiveSessions";

export const metadata: Metadata = {
  title: "Active Sessions",
};

export default function ActiveSessionsPage() {
  return <ActiveSessions />;
}
