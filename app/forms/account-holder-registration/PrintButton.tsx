"use client";

import { Icon } from "@/components/icons";

/** Opens the browser's print dialog ("Save as PDF" downloads the sheet). */
export function PrintButton({ label = "Print / Save as PDF", disabled }: { label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
    >
      <Icon name="download" className="size-4" />
      {label}
    </button>
  );
}
