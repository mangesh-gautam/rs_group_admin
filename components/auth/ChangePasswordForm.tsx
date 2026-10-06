"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isStrongPassword } from "@/lib/auth/passwordRules";
import type { AuthUser } from "@/lib/auth/types";
import { Alert, Field, PasswordInput, PasswordRulesList, Spinner } from "./FormControls";

type Errors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

type Props = {
  submitLabel?: string;
  /** Called after a successful change (e.g. redirect after the mandatory change). */
  onSuccess?: (user: AuthUser) => void;
};

/**
 * Current / New / Confirm password — used by the mandatory first-login screen
 * and by Settings → Security for both roles.
 */
export function ChangePasswordForm({ submitLabel = "Update Password", onSuccess }: Props) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearField = (field: keyof Errors) => {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!currentPassword) found.currentPassword = "Enter your current password";
    if (!newPassword) found.newPassword = "Enter a new password";
    else if (!isStrongPassword(newPassword)) found.newPassword = "Password doesn't meet the requirements";
    else if (newPassword === currentPassword) {
      found.newPassword = "New password must be different from the current password";
    }
    if (!confirmPassword) found.confirmPassword = "Confirm the new password";
    else if (confirmPassword !== newPassword) found.confirmPassword = "Passwords do not match";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrent("");
      setNew("");
      setConfirm("");
      if (onSuccess) {
        onSuccess(result.user);
      } else {
        setSuccess(
          result.revokedSessions > 0
            ? `Password updated. You were signed out on ${result.revokedSessions} other device${result.revokedSessions === 1 ? "" : "s"}.`
            : "Password updated successfully.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details as Errors);
      else setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Field label="Current Password" required error={errors.currentPassword} htmlFor="currentPassword">
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(v) => {
            setCurrent(v);
            clearField("currentPassword");
          }}
          placeholder="Enter current password"
          error={errors.currentPassword}
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="New Password" required error={errors.newPassword} htmlFor="newPassword">
          <PasswordInput
            id="newPassword"
            value={newPassword}
            onChange={(v) => {
              setNew(v);
              clearField("newPassword");
            }}
            placeholder="Enter new password"
            error={errors.newPassword}
          />
        </Field>
        <Field label="Confirm New Password" required error={errors.confirmPassword} htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(v) => {
              setConfirm(v);
              clearField("confirmPassword");
            }}
            placeholder="Re-enter new password"
            error={errors.confirmPassword}
          />
        </Field>
      </div>

      <PasswordRulesList password={newPassword} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-7 sm:w-auto text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Spinner /> : <Icon name="lock" className="size-4" />}
          {submitting ? "Updating…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
