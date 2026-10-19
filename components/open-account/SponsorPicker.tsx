"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Sponsor } from "@/lib/referral/types";

const INVALID = "Invalid Sponsor ID. No active account found.";

/**
 * Sponsor of a new account: search by account no., name or mobile and pick an
 * existing account. Name and (masked) mobile are shown read-only — they come
 * from the sponsor's account, never typed. `onChange` reports the chosen
 * account number ("" = no sponsor) and whether the typed ID is invalid.
 */
export function SponsorPicker({
  value,
  error,
  onChange,
}: {
  /** Initial account number (the picker keeps its own state afterwards). */
  value: string;
  error?: string;
  onChange: (accountNo: string, invalid: boolean) => void;
}) {
  const { authFetch } = useAuth();
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<Sponsor[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Sponsor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestions while typing (debounced). The parent remounts this picker when its form is reset.
  const q = query.trim();
  const searching = q.length >= 2 && selected?.accountNo !== q.toUpperCase();
  const shown = searching ? items : [];
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      authFetch<{ items: Sponsor[] }>(`/api/customers/sponsors?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => { setItems(r.items); setActive(0); }, () => {});
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [authFetch, q, searching]);

  const choose = (s: Sponsor) => {
    setSelected(s);
    setQuery(s.accountNo);
    setInvalid(false);
    setOpen(false);
    onChange(s.accountNo, false);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setInvalid(false);
    onChange("", false);
  };

  // Typed a full account number without picking → look it up exactly.
  const verifyTyped = async () => {
    const q = query.trim().toUpperCase().replace(/\s/g, "");
    if (!q) { clear(); return; }
    if (selected?.accountNo === q) return;
    try {
      const s = await authFetch<Sponsor>(`/api/customers/sponsors/${encodeURIComponent(q)}`);
      choose(s);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSelected(null);
        setInvalid(true);
        onChange(q, true);
      }
    }
  };

  const message = error ?? (invalid ? INVALID : undefined);

  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
      <div className="relative">
        <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium text-navy">
          Sponsor ID <span className="font-normal text-slate-500">(Optional)</span>
        </label>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-invalid={!!message}
            autoComplete="off"
            placeholder="Account no., name or mobile"
            value={query}
            className={`${inputCls(message)} pl-9 font-mono`}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setInvalid(false);
              if (selected) { setSelected(null); onChange("", false); }
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); void verifyTyped(); }, 150); }}
            onKeyDown={(e) => {
              if (!open || !shown.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); choose(shown[active]); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          {(selected || query) && (
            <button type="button" onClick={clear} aria-label="Clear sponsor" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-navy">
              <Icon name="x" className="size-4" />
            </button>
          )}
        </div>
        {open && shown.length > 0 && (
          <ul id={`${listId}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full min-w-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {shown.map((s, i) => (
              <li
                key={s.accountNo}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current); choose(s); }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span className="font-mono text-xs text-navy">{s.accountNo}</span>
                <span className="block text-slate-700">{s.name} <span className="text-xs text-slate-400">· {s.mobile} · {s.office.name}</span></span>
              </li>
            ))}
          </ul>
        )}
        {message && <p role="alert" className="mt-1 text-xs text-red-600">{message}</p>}
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-navy">Sponsor Name</span>
        <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 sm:h-10">
          {selected ? <span className="flex items-center gap-1.5"><Icon name="checkCircle" className="size-4 text-emerald-600" />{selected.name}</span> : <span className="text-slate-400">Filled from the sponsor&apos;s account</span>}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-navy">Sponsor Mobile</span>
        <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 font-mono text-sm text-slate-700 sm:h-10">
          {selected ? selected.mobile : <span className="font-sans text-slate-400">—</span>}
        </div>
      </div>
    </div>
  );
}
