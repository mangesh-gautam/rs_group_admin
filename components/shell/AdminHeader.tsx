"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Logo } from "./Logo";
import { MobileNavButton } from "./MobileNav";
import { UserMenu, type UserMenuLink } from "./UserMenu";

export function AdminHeader({ notificationCount }: { notificationCount: number }) {
  const { user } = useAuth();

  const links: UserMenuLink[] = [
    { label: "My Profile", href: "/admin/profile", icon: "userCircle" },
    { label: "Security & Password", href: "/admin/settings/security", icon: "lock" },
  ];
  if (user?.role === "SUPER_ADMIN") {
    links.unshift({ label: "Super Admin Panel", href: "/super-admin/dashboard", icon: "shieldCheck" });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-6 sm:px-4 lg:px-6">
      <MobileNavButton />
      <div className="min-w-0 flex-1 md:flex-none lg:w-56">
        <Logo href="/admin/dashboard" hideWordmarkOnTiny />
      </div>

      {/* Search — UI only, no search logic wired yet */}
      <label className="relative hidden max-w-xl flex-1 md:block">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          placeholder="Search by Account No, Customer ID or Name..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-5">
        <button
          type="button"
          className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Icon name="bell" className="size-5" />
          {notificationCount > 0 && (
            <span className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              {notificationCount}
            </span>
          )}
        </button>
        <UserMenu links={links} />
      </div>
    </header>
  );
}
