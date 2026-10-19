"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/** A member-portal login, as returned once when it is generated (account opened / password reset). */
export type MemberLogin = { username: string; password: string };

/**
 * The generated member-portal login, to hand to the account holder. The password is
 * shown only this once (only its hash is stored); a lost password is replaced with
 * "Generate new password" on the account page.
 */
export function MemberCredentials({ login, mobileNumber }: { login: MemberLogin; mobileNumber?: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="lock" className="size-4" /> Member portal login — give this to the account holder
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Credential label="Username" value={login.username} />
        <Credential label="Password" value={login.password} />
      </dl>
      <p className="mt-3 text-xs text-amber-900">
        The password is shown only now. At sign-in the holder also receives an OTP on the registered mobile number
        {mobileNumber ? ` (+91 ${mobileNumber})` : ""}. The portal only shows the account — it can&apos;t deposit or withdraw.
      </p>
    </div>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <dt className="text-[11px] text-amber-800 uppercase">{label}</dt>
        <dd className="truncate font-mono text-base font-semibold text-navy select-all">{value}</dd>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        className="shrink-0 rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
