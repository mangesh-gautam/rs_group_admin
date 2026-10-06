"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { PASSWORD_RULES } from "@/lib/auth/passwordRules";

/* Small form building blocks shared by the auth screens. */

export const inputCls = (error?: string) =>
  `h-11 w-full rounded-lg border bg-white px-4 text-base text-slate-800 sm:text-sm outline-none placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-slate-200 focus:border-brand focus:ring-brand/15"
  }`;

export function Field({
  label,
  required,
  optional,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-navy">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {optional && <span className="font-normal text-slate-500"> (Optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  error,
  autoComplete = "new-password",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Icon
        name="lock"
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500"
      />
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={`${inputCls(error)} pr-11 pl-11`}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-navy"
      >
        <Icon name={visible ? "eyeOff" : "eye"} className="size-4" />
      </button>
    </div>
  );
}

/** Live checklist of the password policy. */
export function PasswordRulesList({ password }: { password: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-blue-100 bg-brand-soft/60 p-4">
      <Icon name="info" className="mt-0.5 size-5 shrink-0 text-brand" />
      <div>
        <p className="text-sm font-medium text-navy">Password Requirements</p>
        <ul className="mt-2 space-y-1 text-[13px]">
          {PASSWORD_RULES.map((r) => {
            const ok = password.length > 0 && r.test(password);
            return (
              <li
                key={r.label}
                className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-slate-600"}`}
              >
                {ok ? (
                  <Icon name="check" className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <span className="mx-1 size-1 rounded-full bg-current" />
                )}
                {r.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-100 bg-brand-soft/70 text-navy",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  const icon = { error: "info", success: "checkCircle", info: "info", warning: "info" } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${styles}`}
    >
      <Icon name={icon[tone]} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
