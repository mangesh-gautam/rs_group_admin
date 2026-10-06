"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/auth/types";

export type UserMenuLink = { label: string; href: string; icon: IconName };

/** Avatar + name dropdown with links and Sign out, shared by both headers. */
export function UserMenu({ links }: { links: UserMenuLink[] }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50 sm:gap-3 sm:px-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {user.fullName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-navy">{user.fullName}</span>
          <span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <Icon name="chevronDown" className="hidden size-4 text-slate-500 sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-navy">@{user.username}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          {links.map((l) => (
            <Link
              key={l.href}
              role="menuitem"
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Icon name={l.icon} className="size-4 text-brand" />
              {l.label}
            </Link>
          ))}
          <button
            role="menuitem"
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await logout();
            }}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Icon name="logOut" className="size-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
