"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Alert } from "@/components/auth/FormControls";
import { FullPageLoader, RequireAuth } from "@/components/auth/RequireAuth";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { homeFor } from "@/lib/auth/types";

/**
 * Mandatory "Update Your Password" step. Shown after sign-in while
 * mustChangePassword is true (first login, or after a Super Admin reset).
 * The dashboards redirect here, and the backend blocks every other API.
 */
export function MandatoryPasswordChange() {
  return (
    <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]} allowPendingPasswordChange>
      <Content />
    </RequireAuth>
  );
}

function Content() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Nothing to do here once the password is changed.
  useEffect(() => {
    if (user && !user.mustChangePassword) router.replace(homeFor(user.role));
  }, [user, router]);

  if (!user || !user.mustChangePassword) return <FullPageLoader label="Opening your dashboard…" />;

  const firstLogin = !user.passwordChangedAt;

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#f4f7fc] to-[#e3edfb] px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-xl shadow-brand/5">
        <div className="flex items-center justify-between">
          <Logo href="/change-password" />
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600"
          >
            <Icon name="logOut" className="size-4" />
            Sign out
          </button>
        </div>

        <div className="mt-8 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="shieldCheck" className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-navy">Update Your Password</h1>
            <p className="mt-1 text-sm text-slate-600">
              Hi {user.fullName.split(" ")[0]},{" "}
              {firstLogin
                ? "welcome aboard! For your security, replace the temporary password you were given before continuing."
                : "your password was reset by the Super Admin. Choose a new password to continue."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Alert tone="warning">
            You can&apos;t access the dashboard until your password is updated.
          </Alert>
        </div>

        <div className="mt-6">
          <ChangePasswordForm
            submitLabel="Update Password & Continue"
            onSuccess={(u) => router.replace(homeFor(u.role))}
          />
        </div>
      </div>
    </main>
  );
}
