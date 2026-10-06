"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Field,
  PasswordInput,
  PasswordRulesList,
  Spinner,
  inputCls,
} from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isStrongPassword } from "@/lib/auth/passwordRules";
import { officeLabel, type AdminAccount } from "@/lib/auth/types";
import { useOffices } from "@/lib/offices/useOffices";

type Values = {
  fullName: string;
  username: string;
  email: string;
  mobileNumber: string;
  officeId: string;
  password: string;
  confirmPassword: string;
};
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = {
  fullName: "",
  username: "",
  email: "",
  mobileNumber: "",
  officeId: "",
  password: "",
  confirmPassword: "",
};

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.fullName.trim()) e.fullName = "Full name is required";
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(v.username.trim())) {
    e.username = "3–50 characters: letters, numbers, dot, underscore or hyphen";
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) e.email = "Enter a valid email address";
  if (!/^[6-9]\d{9}$/.test(v.mobileNumber)) e.mobileNumber = "Enter a valid 10-digit mobile number";
  if (!v.officeId) e.officeId = "Select an office";
  if (!v.password) e.password = "Set an initial password";
  else if (!isStrongPassword(v.password)) e.password = "Password doesn't meet the requirements";
  else if (v.username && v.password.toLowerCase().includes(v.username.trim().toLowerCase())) {
    e.password = "Password must not contain the username";
  }
  if (!v.confirmPassword) e.confirmPassword = "Confirm the password";
  else if (v.confirmPassword !== v.password) e.confirmPassword = "Passwords do not match";
  return e;
}

/** Super Admin → Admin Management → Create Admin (POST /api/super-admin/admins). */
export function CreateAdminForm() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [values, setValues] = useState<Values>(EMPTY);
  const { offices, error: officesError } = useOffices();
  const activeOffices = offices?.filter((o) => o.isActive) ?? [];
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AdminAccount | null>(null);

  const set = (field: keyof Values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const admin = await authFetch<AdminAccount>("/api/super-admin/admins", {
        method: "POST",
        body: {
          ...values,
          fullName: values.fullName.trim(),
          username: values.username.trim(),
          email: values.email.trim(),
        },
      });
      setCreated(admin);
      setValues(EMPTY);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "VALIDATION_ERROR" || err.code === "CONFLICT")) {
        setErrors(err.details as Errors);
        if (err.code === "CONFLICT") setFormError(err.message);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <span className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="checkCircle" className="size-8" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-navy">Admin account created</h2>
        <p className="mt-1 text-sm text-slate-600">
          Share the username and temporary password with <b>{created.fullName}</b> privately. They
          will verify an OTP on <b>+91 {created.mobileNumber}</b> and must set a new password on
          first sign-in.
        </p>
        <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Username</dt>
            <dd className="font-mono text-navy">{created.username}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Employee / Admin ID</dt>
            <dd className="font-mono font-semibold text-navy">{created.employeeId}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Office</dt>
            <dd className="text-navy">{officeLabel(created.office)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="text-navy">Active · must change password</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Mobile verified</dt>
            <dd className="text-navy">Pending first OTP sign-in</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/super-admin/admin-management/${created.id}`}
            className="flex h-11 items-center rounded-lg border border-brand/50 px-5 text-sm font-medium text-brand hover:bg-brand-soft"
          >
            View admin
          </Link>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            <Icon name="userPlus" className="size-4" /> Create another
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7"
    >
      <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold text-navy">
        <Icon name="userPlus" className="size-7 text-navy" />
        Admin Details &amp; Credentials
      </h2>

      {formError && (
        <div className="mb-5">
          <Alert tone="error">{formError}</Alert>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 md:grid-cols-2">
        <Field label="Full Name" required error={errors.fullName} htmlFor="fullName">
          <input
            id="fullName"
            className={inputCls(errors.fullName)}
            placeholder="Enter full name"
            value={values.fullName}
            onChange={(e) => set("fullName")(e.target.value)}
          />
        </Field>
        <Field label="Employee / Admin ID" htmlFor="employeeId" hint="Assigned automatically when the admin is created">
          <input
            id="employeeId"
            className={`${inputCls()} cursor-not-allowed`}
            value="Auto-generated (EMP001, EMP002 …)"
            disabled
          />
        </Field>
        <Field label="Username" required error={errors.username} htmlFor="username" hint="Used to sign in">
          <input
            id="username"
            className={inputCls(errors.username)}
            placeholder="e.g. ravi.verma"
            autoComplete="off"
            value={values.username}
            onChange={(e) => set("username")(e.target.value)}
          />
        </Field>
        <Field label="Email" required error={errors.email} htmlFor="email">
          <input
            id="email"
            type="email"
            className={inputCls(errors.email)}
            placeholder="name@example.com"
            autoComplete="off"
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Field>
        <Field
          label="Mobile Number"
          required
          error={errors.mobileNumber}
          htmlFor="mobileNumber"
          hint="Login OTPs are sent to this number"
        >
          <div
            className={`flex h-11 overflow-hidden rounded-lg border focus-within:ring-2 ${
              errors.mobileNumber
                ? "border-red-300 focus-within:ring-red-100"
                : "border-slate-200 focus-within:border-brand focus-within:ring-brand/15"
            }`}
          >
            <span className="flex items-center gap-3 border-r border-slate-200 px-4 text-sm text-slate-700">
              <Icon name="phone" className="size-4" />
              +91
            </span>
            <input
              id="mobileNumber"
              className="min-w-0 flex-1 px-4 text-base outline-none placeholder:text-slate-400 sm:text-sm"
              placeholder="Enter 10 digit mobile number"
              inputMode="numeric"
              autoComplete="off"
              value={values.mobileNumber}
              onChange={(e) => set("mobileNumber")(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
        </Field>
        <Field
          label="Office"
          required
          error={errors.officeId ?? officesError ?? undefined}
          htmlFor="officeId"
          hint={
            <>
              Office the admin works from.{" "}
              <Link href="/super-admin/offices" className="font-medium text-brand hover:underline">
                Manage offices
              </Link>
            </>
          }
        >
          <select
            id="officeId"
            className={`${inputCls(errors.officeId)} ${values.officeId ? "" : "text-slate-400"}`}
            value={values.officeId}
            onChange={(e) => set("officeId")(e.target.value)}
            disabled={!offices}
          >
            <option value="" disabled>
              {offices ? (activeOffices.length ? "Select office location" : "No offices yet — add one first") : "Loading offices…"}
            </option>
            {activeOffices.map((o) => (
              <option key={o.id} value={o.id} className="text-slate-800">
                {officeLabel(o)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Initial Password" required error={errors.password} htmlFor="password">
          <PasswordInput
            id="password"
            value={values.password}
            onChange={set("password")}
            placeholder="Enter temporary password"
            error={errors.password}
          />
        </Field>
        <Field label="Confirm Password" required error={errors.confirmPassword} htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            value={values.confirmPassword}
            onChange={set("confirmPassword")}
            placeholder="Re-enter temporary password"
            error={errors.confirmPassword}
          />
        </Field>
      </div>

      <div className="mt-7">
        <PasswordRulesList password={values.password} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end sm:gap-4">
        <button
          type="button"
          onClick={() => router.push("/super-admin/admin-management")}
          className="h-11 w-full rounded-lg border border-brand/50 px-9 text-sm font-medium text-navy hover:bg-brand-soft sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-8 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-70 sm:w-auto"
        >
          {submitting ? <Spinner /> : <Icon name="userPlus" className="size-5" />}
          {submitting ? "Creating…" : "Create Admin"}
        </button>
      </div>
    </form>
  );
}
