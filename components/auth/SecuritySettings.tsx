"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { ChangePasswordForm } from "./ChangePasswordForm";

/** Settings → Security → Change Password (both roles). */
export function SecuritySettings({ breadcrumb }: { breadcrumb: string }) {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">{breadcrumb}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Change Password</h1>
        <p className="text-sm text-slate-600">
          Use a strong password you don&apos;t use anywhere else. Other signed-in devices will be
          signed out.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <ChangePasswordForm />
        </section>

        <aside className="space-y-4 rounded-2xl border border-blue-100 bg-gradient-to-b from-[#eef4fd] to-[#e3edfb] p-5 text-sm">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <Icon name="shieldCheck" className="size-5 text-brand" /> Account security
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Password last changed</dt>
              <dd className="text-navy">{formatDateTime(user?.passwordChangedAt ?? null)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last sign-in</dt>
              <dd className="text-navy">{formatDateTime(user?.lastLoginAt ?? null)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Two-step verification</dt>
              <dd className="text-navy">
                {user?.role === "ADMIN" ? `OTP to ${user.mobileNumber}` : "Password"}
              </dd>
            </div>
          </dl>
          <p className="rounded-lg bg-white/70 p-3 text-xs leading-relaxed text-slate-600">
            Never share your password or OTP. RS Group Society staff will never ask for them.
          </p>
        </aside>
      </div>
    </div>
  );
}
