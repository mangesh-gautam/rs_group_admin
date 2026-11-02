"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";

type IconName = ComponentProps<typeof Icon>["name"];

/**
 * A review / confirmation popup: header, scrolling body, a primary action and a way back.
 * Not a <form>, so it can be shown from inside a form without nesting one (and without
 * re-submitting it). Esc and the backdrop go back (not while busy); the primary button is focused.
 */
export function ConfirmDialog({ title, subtitle, icon, busy, confirmLabel, busyLabel, backLabel, onConfirm, onBack, extra, wide, children }: {
  title: string;
  subtitle?: string;
  icon: IconName;
  busy: boolean;
  confirmLabel: string;
  busyLabel: string;
  backLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  /** an additional secondary action (e.g. Cancel next to Go back) */
  extra?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onBack(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onBack, busy]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6" onClick={() => !busy && onBack()}>
      <div onClick={(e) => e.stopPropagation()}
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name={icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-semibold text-navy">{title}</h2>
            {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
          {extra}
          <button type="button" onClick={onBack} disabled={busy}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {backLabel}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-70">
            {busy && <Spinner />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
