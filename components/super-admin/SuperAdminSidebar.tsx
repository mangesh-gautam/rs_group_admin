"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { activeHref } from "@/components/shell/AdminSidebar";
import { MobileDrawer, useMobileNav } from "@/components/shell/MobileNav";

export type SuperAdminNavItem = { label: string; href: string; icon: IconName };

type Props = {
  items: SuperAdminNavItem[];
  notice: { title: string; body: string };
};

/** Desktop sidebar (lg+) and the same navigation in the mobile drawer. */
export function SuperAdminSidebar(props: Props) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col bg-navy py-6 text-slate-200 lg:flex">
        <SidebarContent {...props} />
      </aside>
      <MobileDrawer>
        <div className="flex flex-1 flex-col pb-6">
          <SidebarContent {...props} />
        </div>
      </MobileDrawer>
    </>
  );
}

function SidebarContent({ items, notice }: Props) {
  const pathname = usePathname();
  const { setOpen } = useMobileNav();
  const current = activeHref(pathname, items.map((i) => i.href));
  const close = () => setOpen(false);

  return (
    <>
      <div className="px-4">
        <Link
          href="/super-admin/dashboard"
          onClick={close}
          className="flex items-center gap-3 rounded-lg bg-brand px-4 py-3 font-medium text-white shadow-md shadow-black/20"
        >
          <Icon name="shieldCheck" className="size-6" />
          Super Admin
        </Link>
      </div>

      <nav className="mt-3">
        {items.map((item) => {
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 border-l-4 px-7 py-3.5 text-sm transition-colors ${
                active
                  ? "border-brand bg-navy-light font-medium text-white"
                  : "border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon name={item.icon} className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 pt-8">
        <p className="flex items-center gap-3 border-b border-white/15 pb-4 text-sm font-medium text-white">
          <Icon name="lock" className="size-5" />
          {notice.title}
        </p>
        <p className="pt-4 text-xs leading-relaxed text-slate-400">{notice.body}</p>
        <Link
          href="/admin/dashboard"
          onClick={close}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
        >
          <Icon name="arrowRight" className="size-3.5 rotate-180" />
          Back to Admin Panel
        </Link>
      </div>
    </>
  );
}
