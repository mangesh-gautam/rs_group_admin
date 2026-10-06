"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { homeFor, type Role } from "@/lib/auth/types";

type Props = {
  children: ReactNode;
  /** Roles allowed to see this tree. Backend APIs enforce the same rules. */
  roles: Role[];
  /** Render even when the user must still change their password. */
  allowPendingPasswordChange?: boolean;
};

/**
 * Client-side route protection (UX only — the backend is the real boundary):
 * signed out → /login?next=…, password change pending → /change-password,
 * wrong role → 403 screen.
 */
export function RequireAuth({ children, roles, allowPendingPasswordChange = false }: Props) {
  const { status, user, endReason } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const mustChange = !!user?.mustChangePassword && !allowPendingPasswordChange;

  useEffect(() => {
    if (status === "unauthenticated") {
      if (endReason === "signedOut") {
        router.replace("/login"); // explicit sign-out: don't carry the old page over
        return;
      }
      const params = new URLSearchParams({ next: pathname });
      if (endReason === "expired") params.set("reason", "expired");
      router.replace(`/login?${params}`);
    } else if (status === "authenticated" && mustChange) {
      router.replace("/change-password");
    }
  }, [status, mustChange, endReason, pathname, router]);

  if (status !== "authenticated" || !user || mustChange) return <FullPageLoader />;
  if (!roles.includes(user.role)) return <Forbidden homeHref={homeFor(user.role)} />;
  return <>{children}</>;
}

export function FullPageLoader({ label = "Checking your session…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
        <span className="size-9 animate-spin rounded-full border-3 border-brand-soft border-t-brand" />
        {label}
      </div>
    </div>
  );
}

export function Forbidden({ homeHref }: { homeHref: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-50 text-red-500">
          <Icon name="lock" className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-navy">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account doesn&apos;t have permission to open this page.
        </p>
        <Link
          href={homeHref}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
