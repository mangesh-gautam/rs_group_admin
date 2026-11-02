"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/** A member-portal login to hand over: username from the API, the initial password the Admin just set. */
export type MemberLogin = { username: string; password: string };

/**
 * The member-portal login to hand to the account holder, right after the Admin set the
 * password (account opened / new password). The API never returns passwords — this is the one
 * typed in this browser, shown only now. It stays valid; a member who forgets it resets it in the
 * app (OTP to the registered mobile) or gets a new one at the office.
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
        Shown only now — give it to the holder in person. Every sign-in also needs an OTP sent to the registered mobile
        number{mobileNumber ? ` (+91 ${mobileNumber})` : ""}. A forgotten password can be reset in the app (&quot;Forgot password?&quot;,
        OTP to the same mobile) or here at the office. The portal only shows the account — it can&apos;t deposit or withdraw.
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
