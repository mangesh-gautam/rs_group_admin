"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { MEMBER_PASSWORD_RULES, suggestMemberPassword } from "@/lib/accounts/memberPassword";

/**
 * The initial member-portal password an Admin sets (open account / new password): password +
 * confirmation, show / hide, "Suggest a strong password" and the rules ticked as they are met.
 */
export function MemberPasswordFields({ password, confirm, onChange, errors, idPrefix, disabled }: {
  password: string;
  confirm: string;
  onChange: (next: { password: string; confirm: string }) => void;
  errors: { password?: string; confirm?: string };
  idPrefix: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Initial password" required error={errors.password} htmlFor={`${idPrefix}-pw`}>
          <div className="relative">
            <input id={`${idPrefix}-pw`} type={type} value={password} disabled={disabled} autoComplete="new-password"
              onChange={(e) => onChange({ password: e.target.value, confirm })}
              className={`${inputCls(errors.password)} pr-10 font-mono`} placeholder="Set a password" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-navy">
              <Icon name={show ? "eyeOff" : "eye"} className="size-4" />
            </button>
          </div>
        </Field>
        <Field label="Confirm password" required error={errors.confirm} htmlFor={`${idPrefix}-pw2`}>
          <input id={`${idPrefix}-pw2`} type={type} value={confirm} disabled={disabled} autoComplete="new-password"
            onChange={(e) => onChange({ password, confirm: e.target.value })}
            className={`${inputCls(errors.confirm)} font-mono`} placeholder="Type it again" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={disabled}
          onClick={() => { const pw = suggestMemberPassword(); setShow(true); onChange({ password: pw, confirm: pw }); }}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-brand/40 px-3 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50">
          <Icon name="refresh" className="size-3.5" /> Suggest a strong password
        </button>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" aria-label="Password rules">
          {MEMBER_PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.label} className={ok ? "text-emerald-700" : "text-slate-500"}>
                {ok ? "✓" : "•"} {r.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
