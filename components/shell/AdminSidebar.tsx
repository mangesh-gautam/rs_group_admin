"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { MobileDrawer, useMobileNav } from "./MobileNav";

export type NavItem = { label: string; href: string; icon: IconName };
export type NavSection = { title?: string; items: NavItem[] };

/** The nav item whose href is the longest prefix of the current path. */
export function activeHref(pathname: string, hrefs: string[]) {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Desktop sidebar (lg+) and the same navigation in the mobile drawer. */
export function AdminSidebar({ sections }: { sections: NavSection[] }) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 bg-navy px-3 py-4 text-slate-200 lg:block">
        <div className="sticky top-20">
          <NavLinks sections={sections} />
        </div>
      </aside>
      <MobileDrawer>
        <div className="px-3 pb-6">
          <NavLinks sections={sections} />
        </div>
      </MobileDrawer>
    </>
  );
}

function NavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const { setOpen } = useMobileNav();
  const current = activeHref(
    pathname,
    sections.flatMap((s) => s.items.map((i) => i.href)),
  );

  return (
    <nav className="space-y-5">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {section.title}
            </p>
          )}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = current === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-brand font-medium text-white shadow-sm"
                        : "hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon name={item.icon} className="size-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
