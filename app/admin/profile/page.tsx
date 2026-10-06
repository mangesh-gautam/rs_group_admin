import type { Metadata } from "next";
import { ProfileCard } from "@/components/admin/ProfileCard";

export const metadata: Metadata = {
  title: "My Profile",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">My Profile</h1>
        <p className="text-sm text-slate-600">
          Your account details. Contact the Super Admin to change them.
        </p>
      </div>
      <ProfileCard />
    </div>
  );
}
