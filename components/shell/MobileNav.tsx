"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icons";

/**
 * Mobile navigation drawer shared by the Admin and Super Admin shells.
 * Below the `lg` breakpoint the sidebar is hidden; the header's hamburger
 * opens the same navigation in a slide-in drawer.
 */

type MobileNavState = { open: boolean; setOpen: (open: boolean) => void };

const MobileNavContext = createContext<MobileNavState | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // While open: lock page scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used inside <MobileNavProvider>");
  return ctx;
}

/** Hamburger button — rendered in the header, hidden on desktop. */
export function MobileNavButton() {
  const { open, setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
      aria-expanded={open}
      aria-controls="mobile-nav"
      className="-ml-1 rounded-lg p-2 text-navy hover:bg-slate-100 lg:hidden"
    >
      <Icon name="menu" className="size-6" />
    </button>
  );
}

/** Slide-in panel from the left with a backdrop. */
export function MobileDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useMobileNav();
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!open}
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-navy text-slate-200 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end px-3 pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
