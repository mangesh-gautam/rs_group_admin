"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";

export function WelcomeBanner() {
  const { user } = useAuth();
  if (!user) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-navy to-navy-light p-5 text-white">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-white/10">
          <Icon name="home" className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold">
            {greeting}, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-300">Here&apos;s what&apos;s happening at RS Group Society today.</p>
        </div>
      </div>
      <p className="text-xs text-slate-300">
        Last sign-in: <span className="text-white">{formatDateTime(user.lastLoginAt)}</span>
      </p>
    </div>
  );
}
