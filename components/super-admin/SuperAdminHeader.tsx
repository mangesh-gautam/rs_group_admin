"use client";

import { Icon } from "@/components/icons";
import { Logo } from "@/components/shell/Logo";
import { MobileNavButton } from "@/components/shell/MobileNav";
import { UserMenu } from "@/components/shell/UserMenu";

export function SuperAdminHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:h-[72px] sm:px-4 lg:px-9">
      <MobileNavButton />
      <div className="min-w-0 flex-1">
        <Logo href="/super-admin/dashboard" hideWordmarkOnTiny />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        <span className="hidden items-center gap-2 sm:flex">
          <Icon name="shieldCheck" className="size-6 text-brand" />
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Super Admin
          </span>
        </span>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" />
        <UserMenu
          links={[
            { label: "Settings & Password", href: "/super-admin/settings", icon: "settings" },
            { label: "Admin Panel", href: "/admin/dashboard", icon: "home" },
          ]}
        />
      </div>
    </header>
  );
}
