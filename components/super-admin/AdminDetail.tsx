"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Field,
  PasswordInput,
  PasswordRulesList,
  Spinner,
} from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatLocation } from "@/lib/auth/location";
import { isStrongPassword } from "@/lib/auth/passwordRules";
import { formatDateTime, officeLabel, type AccountStatus, type AdminAccount } from "@/lib/auth/types";
import { useOffices } from "@/lib/offices/useOffices";
import { PasswordStateBadge, StatusBadge } from "./AdminBadges";

type ActionResult = { admin: AdminAccount; revokedSessions: number };

/** Admin Management → Select Admin: details, activate/deactivate/lock, reset password. */
export function AdminDetail({ id }: { id: string }) {
  const { authFetch } = useAuth();
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [loadError, setLoadError] = useState<ApiError | Error | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyStatus, setBusyStatus] = useState<AccountStatus | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      authFetch<AdminAccount>(`/api/super-admin/admins/${id}`, { signal })
        .then(setAdmin)
        .catch((err) => {
          if ((err as Error).name !== "AbortError") setLoadError(err);
        }),
    [authFetch, id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const changeStatus = async (status: AccountStatus) => {
    if (!admin) return;
    const verb = { ACTIVE: "activate", INACTIVE: "deactivate", LOCKED: "lock" }[status];
    if (status !== "ACTIVE" && !window.confirm(`Are you sure you want to ${verb} ${admin.fullName}? They will be signed out immediately.`)) {
      return;
    }
    setBusyStatus(status);
    setNotice(null);
    try {
      const result = await authFetch<ActionResult>(`/api/super-admin/admins/${admin.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setAdmin(result.admin);
      setNotice({
        tone: "success",
        text:
          status === "ACTIVE"
            ? `${result.admin.fullName} can sign in again.`
            : `${result.admin.fullName} was ${verb === "lock" ? "locked" : `${verb}d`}${
                result.revokedSessions > 0
                  ? ` and signed out of ${result.revokedSessions} active session${result.revokedSessions === 1 ? "" : "s"}`
                  : ""
              }.`,
      });
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusyStatus(null);
    }
  };

  if (loadError) {
    const notFound = loadError instanceof ApiError && loadError.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert tone="error">{notFound ? "This admin does not exist." : errorMessage(loadError)}</Alert>
        <Link href="/super-admin/admin-management" className="text-sm font-medium text-brand hover:underline">
          ← Back to Admin Management
        </Link>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-72 animate-pulse rounded bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const details: [string, string][] = [
    ["Username", admin.username],
    ["Email", admin.email],
    ["Mobile Number", `+91 ${admin.mobileNumber}${admin.mobileVerified ? " (verified)" : " (not verified yet)"}`],
    ["Employee / Admin ID", admin.employeeId ?? "—"],
    ["Office", officeLabel(admin.office)],
    ["Created", formatDateTime(admin.createdAt)],
    ["Admin User ID", admin.id],
    ["Last Sign-in", formatDateTime(admin.lastLoginAt)],
    ["Last Sign-in Location", formatLocation(admin.lastLoginLocation)],
    ["Password Last Changed", formatDateTime(admin.passwordChangedAt)],
    ["Temporary Lock", admin.temporarilyLocked ? `Until ${formatDateTime(admin.lockedUntil)}` : "None"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/super-admin/admin-management"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy"
        >
          <Icon name="arrowRight" className="size-4 rotate-180" /> Admin Management
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-navy">{admin.fullName}</h1>
          <StatusBadge admin={admin} />
          <PasswordStateBadge mustChange={admin.mustChangePassword} />
        </div>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-navy">
            <Icon name="idCard" className="size-5 text-brand" /> Admin Details
          </h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
                <dd className="mt-1 text-sm break-words text-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy">
              <Icon name="shieldCheck" className="size-5 text-brand" /> Account Status
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Deactivating or locking signs the admin out of every device immediately.
            </p>
            <div className="grid gap-2">
              {admin.status !== "ACTIVE" || admin.temporarilyLocked ? (
                <StatusButton
                  onClick={() => changeStatus("ACTIVE")}
                  busy={busyStatus === "ACTIVE"}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  icon="checkCircle"
                  label={admin.temporarilyLocked && admin.status === "ACTIVE" ? "Unlock & Activate" : "Activate"}
                />
              ) : null}
              {admin.status !== "INACTIVE" && (
                <StatusButton
                  onClick={() => changeStatus("INACTIVE")}
                  busy={busyStatus === "INACTIVE"}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50"
                  icon="x"
                  label="Deactivate"
                />
              )}
              {admin.status !== "LOCKED" && (
                <StatusButton
                  onClick={() => changeStatus("LOCKED")}
                  busy={busyStatus === "LOCKED"}
                  className="border border-red-200 text-red-600 hover:bg-red-50"
                  icon="lock"
                  label="Lock account"
                />
              )}
            </div>
          </section>

          <OfficePanel
            admin={admin}
            onChanged={(updated) => {
              setAdmin(updated);
              setNotice({ tone: "success", text: `${updated.fullName} now works from ${officeLabel(updated.office)}.` });
            }}
          />

          <ResetPasswordPanel
            admin={admin}
            onReset={(result) => {
              setAdmin(result.admin);
              setNotice({
                tone: "success",
                text: `Temporary password set. ${result.admin.fullName} was signed out and must change it at next sign-in.`,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusButton({
  onClick,
  busy,
  className,
  icon,
  label,
}: {
  onClick: () => void;
  busy: boolean;
  className: string;
  icon: "checkCircle" | "x" | "lock";
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:opacity-60 ${className}`}
    >
      {busy ? <Spinner /> : <Icon name={icon} className="size-4" />}
      {label}
    </button>
  );
}

function ResetPasswordPanel({
  admin,
  onReset,
}: {
  admin: AdminAccount;
  onReset: (result: ActionResult) => void;
}) {
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!isStrongPassword(newPassword)) found.newPassword = "Password doesn't meet the requirements";
    if (confirmPassword !== newPassword) found.confirmPassword = "Passwords do not match";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await authFetch<ActionResult>(`/api/super-admin/admins/${admin.id}/reset-password`, {
        method: "POST",
        body: { newPassword, confirmPassword },
      });
      setNew("");
      setConfirm("");
      setOpen(false);
      onReset(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details);
      else setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy">
        <Icon name="refresh" className="size-5 text-brand" /> Reset Password
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Sets a temporary password. The admin is signed out and must change it after their next
        password + OTP sign-in.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 text-sm font-medium text-brand hover:bg-brand-soft"
        >
          <Icon name="lock" className="size-4" /> Reset password
        </button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="Temporary Password" required error={errors.newPassword} htmlFor="resetPassword">
            <PasswordInput
              id="resetPassword"
              value={newPassword}
              onChange={(v) => {
                setNew(v);
                setErrors((e) => ({ ...e, newPassword: undefined }));
              }}
              placeholder="New temporary password"
              error={errors.newPassword}
            />
          </Field>
          <Field label="Confirm Password" required error={errors.confirmPassword} htmlFor="resetConfirm">
            <PasswordInput
              id="resetConfirm"
              value={confirmPassword}
              onChange={(v) => {
                setConfirm(v);
                setErrors((e) => ({ ...e, confirmPassword: undefined }));
              }}
              placeholder="Re-enter password"
              error={errors.confirmPassword}
            />
          </Field>
          <PasswordRulesList password={newPassword} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 flex-1 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-70"
            >
              {submitting && <Spinner />}
              {submitting ? "Resetting…" : "Reset password"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Assign / move the Admin to an office (PATCH /api/super-admin/admins/:id/office). */
function OfficePanel({ admin, onChanged }: { admin: AdminAccount; onChanged: (admin: AdminAccount) => void }) {
  const { authFetch } = useAuth();
  const { offices } = useOffices();
  const [officeId, setOfficeId] = useState(admin.office ? String(admin.office.id) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = offices?.filter((o) => o.isActive || o.id === admin.office?.id) ?? [];
  const unchanged = officeId === (admin.office ? String(admin.office.id) : "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!officeId || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authFetch<{ admin: AdminAccount }>(`/api/super-admin/admins/${admin.id}/office`, {
        method: "PATCH",
        body: { officeId: Number(officeId) },
      });
      onChanged(result.admin);
    } catch (err) {
      setError(err instanceof ApiError && err.details.officeId ? err.details.officeId : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy">
        <Icon name="house" className="size-5 text-brand" /> Office
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        {admin.office ? `Currently ${officeLabel(admin.office)}.` : "This admin has no office assigned yet."}
      </p>
      <form onSubmit={save} className="flex gap-2">
        <select
          aria-label="Office"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm"
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          disabled={!offices}
        >
          <option value="" disabled>
            {offices ? "Select office" : "Loading…"}
          </option>
          {choices.map((o) => (
            <option key={o.id} value={o.id}>
              {officeLabel(o)}
              {o.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !officeId || unchanged}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy && <Spinner />}
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
