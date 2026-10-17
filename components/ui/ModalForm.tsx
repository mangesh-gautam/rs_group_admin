"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Spinner } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";

type IconName = ComponentProps<typeof Icon>["name"];

/**
 * A modal form: header with icon + title, scrolling body, Cancel / submit footer.
 * Esc and the backdrop close it (not while saving); the first field gets focus.
 */
export function ModalForm({ title, subtitle, icon, danger, saving, submitLabel, submitDisabled, submitTitle, onSubmit, onCancel, children }: {
  title: string; subtitle: string; icon: IconName; danger?: boolean; saving: boolean;
  submitLabel: string; onSubmit: () => void; onCancel: () => void; children: ReactNode;
  /** the action isn't applicable right now (e.g. the account isn't settled) — the button is greyed out */
  submitDisabled?: boolean; submitTitle?: string;
}) {
  const firstRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    firstRef.current?.querySelector<HTMLInputElement>("input, select")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onCancel, saving]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="corr-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6" onClick={() => !saving && onCancel()}>
      <form noValidate onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!submitDisabled) onSubmit(); }}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-start gap-3 border-b px-5 py-4 ${danger ? "border-red-100 bg-red-50" : "border-slate-100"}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${danger ? "bg-red-100 text-red-700" : "bg-brand-soft text-brand"}`}>
            <Icon name={icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="corr-title" className="font-semibold text-navy">{title}</h2>
            <p className="truncate font-mono text-xs text-slate-600">{subtitle}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            <Icon name="x" className="size-5" />
          </button>
        </div>
        <div ref={firstRef} className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onCancel} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={saving || submitDisabled} title={submitDisabled ? submitTitle : undefined}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${
              submitDisabled ? "cursor-not-allowed bg-slate-400" : danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand/90"}`}>
            {saving && <Spinner />} {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
