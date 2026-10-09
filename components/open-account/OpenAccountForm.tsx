"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useOffices } from "@/lib/offices/useOffices";
import { useAuth } from "@/lib/auth/AuthProvider";
import { officeLabel } from "@/lib/auth/types";
import { INDIAN_STATES } from "@/lib/indianStates";
import { ACCOUNT_TYPES } from "@/lib/deposits/types";

/**
 * Open New Account — the "Account Holder Registration Form" in digital form.
 * Field order follows the paper form. Saved by
 * POST /api/customers/account-holders (customer-service → accounts.account_holders).
 */

type FormValues = {
  name: string;
  fatherHusbandName: string;
  houseNo: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  dob: string;
  mobileNumber: string;
  alternateMobileNumber: string;
  sex: string;
  panNo: string;
  aadhaarNo: string;
  bankName: string;
  bankAccountNo: string;
  ifscCode: string;
  branch: string;
  amount: string;
  accountType: string; // DAILY | WEEKLY | MONTHLY — installment frequency
  interestRate: string; // % per month
  bufferDays: string; // grace days after each monthly due date
  email: string;
  nomineeName: string;
  nomineeAge: string;
  nomineeRelation: string;
  sponsorName: string;
  sponsorMobile: string;
  sponsorId: string;
};

type DocKey = "photo" | "panCard" | "aadhaarCard";
type Errors = Partial<Record<keyof FormValues | DocKey | "officeId", string>>;

type Created = {
  accountNo: string; // RS + office PIN + 6-digit counter, e.g. RS110033000001
  formNo: string; // 000001, 000002 … (generated)
  name: string;
  createdBy: string;
};

const EMPTY: FormValues = {
  name: "",
  fatherHusbandName: "",
  houseNo: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  dob: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  sex: "",
  panNo: "",
  aadhaarNo: "",
  bankName: "",
  bankAccountNo: "",
  ifscCode: "",
  branch: "",
  amount: "",
  accountType: "",
  interestRate: "0.75",
  bufferDays: "5",
  email: "",
  nomineeName: "",
  nomineeAge: "",
  nomineeRelation: "",
  sponsorName: "",
  sponsorMobile: "",
  sponsorId: "",
};

const SEXES = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

// Mirrors customer-service src/lib/documents.ts (the backend is authoritative).
const DOCUMENTS: { key: DocKey; label: string; icon: IconName; accept: string; types: string[]; maxMb: number; hint: string }[] = [
  {
    key: "panCard",
    label: "PAN Card (self-attested copy)",
    icon: "creditCard",
    accept: ".jpg,.jpeg,.png,.pdf",
    types: ["image/jpeg", "image/png", "application/pdf"],
    maxMb: 2,
    hint: "JPG, PNG or PDF · max 2MB",
  },
  {
    key: "aadhaarCard",
    label: "Aadhaar Card (self-attested copy)",
    icon: "idCard",
    accept: ".jpg,.jpeg,.png,.pdf",
    types: ["image/jpeg", "image/png", "application/pdf"],
    maxMb: 2,
    hint: "JPG, PNG or PDF · max 2MB",
  },
];
const PHOTO = { types: ["image/jpeg", "image/png"], maxMb: 1 };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const checkFile = (file: File, types: string[], maxMb: number) =>
  !types.includes(file.type)
    ? "This file type is not allowed"
    : file.size > maxMb * 1024 * 1024
      ? `File must be at most ${maxMb}MB`
      : undefined;

function validate(v: FormValues, files: Partial<Record<DocKey, File>>): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Name is required";
  if (!v.houseNo.trim()) e.houseNo = "Flat No. / Makan No. is required";
  if (!v.address.trim()) e.address = "Address is required";
  if (!v.city.trim()) e.city = "City is required";
  if (!v.state) e.state = "Select a state";
  if (!/^[1-9]\d{5}$/.test(v.pincode)) e.pincode = "Enter a valid 6-digit PIN code";
  if (!v.dob) e.dob = "Date of birth is required";
  if (!/^[6-9]\d{9}$/.test(v.mobileNumber)) e.mobileNumber = "Enter a valid 10-digit mobile number";
  if (v.alternateMobileNumber && !/^[6-9]\d{9}$/.test(v.alternateMobileNumber)) {
    e.alternateMobileNumber = "Enter a valid 10-digit mobile number";
  } else if (v.alternateMobileNumber && v.alternateMobileNumber === v.mobileNumber) {
    e.alternateMobileNumber = "Must be different from Mob.";
  }
  if (!v.sex) e.sex = "Select sex";
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(v.panNo)) e.panNo = "Enter a valid PAN (e.g. ABCDE1234F)";
  if (!/^[2-9]\d{11}$/.test(v.aadhaarNo)) e.aadhaarNo = "Enter a valid 12-digit Aadhaar number";
  if (v.bankAccountNo && !/^\d{9,18}$/.test(v.bankAccountNo)) e.bankAccountNo = "A/c No. must be 9–18 digits";
  if (v.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifscCode)) e.ifscCode = "Enter a valid IFSC (e.g. SBIN0001234)";
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v.amount) || Number(v.amount) <= 0) e.amount = "Enter an amount greater than 0";
  if (!v.accountType) e.accountType = "Select the account type";
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v.interestRate) || Number(v.interestRate) > 10) e.interestRate = "0 to 10 % per month";
  if (!/^\d{1,2}$/.test(v.bufferDays) || Number(v.bufferDays) > 20) e.bufferDays = "0 to 20 days";
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = "Enter a valid email";
  if (v.nomineeAge && !(Number(v.nomineeAge) >= 0 && Number(v.nomineeAge) <= 120)) e.nomineeAge = "0–120";
  if (v.sponsorMobile && !/^[6-9]\d{9}$/.test(v.sponsorMobile)) e.sponsorMobile = "Enter a valid 10-digit mobile number";
  if (!files.photo) e.photo = "Photograph is required";
  for (const doc of DOCUMENTS) if (!files[doc.key]) e[doc.key] = "Required";
  return e;
}

export function OpenAccountForm() {
  const { authFetch, user } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  // Admins open accounts at their own office; the Super Admin picks one.
  const [officeId, setOfficeId] = useState("");
  const officeBlocked = !isSuperAdmin && !user?.office;
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  // Bumped on reset so file inputs (uncontrolled) are remounted empty.
  const [formKey, setFormKey] = useState(0);

  const set = (field: keyof FormValues, clean?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = clean ? clean(e.target.value) : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((err) => ({ ...err, [field]: undefined }));
    };
  const digits = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);
  const upper = (max: number) => (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

  const pickFile = (key: DocKey, file: File | undefined, types: string[], maxMb: number) => {
    const problem = file && checkFile(file, types, maxMb);
    setFiles((f) => ({ ...f, [key]: problem ? undefined : file }));
    setErrors((err) => ({ ...err, [key]: problem }));
    if (key === "photo") {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(file && !problem ? URL.createObjectURL(file) : null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(values, files);
    if (isSuperAdmin && !officeId) found.officeId = "Select the office this account is opened at";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const [photo, panCard, aadhaarCard] = await Promise.all(
        (["photo", "panCard", "aadhaarCard"] as const).map((k) => readAsDataUrl(files[k]!)),
      );
      const result = await authFetch<Created>("/api/customers/account-holders", {
        method: "POST",
        body: { ...values, ...(isSuperAdmin ? { officeId: Number(officeId) } : {}), photo, panCard, aadhaarCard },
      });
      setCreated(result);
      reset();
      // Show the new account's filled Registration Form, ready to print / save as PDF.
      router.push(`/forms/account-holder-registration/${result.accountNo}?download=1&opened=1`);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "VALIDATION_ERROR" || err.code === "CONFLICT")) {
        setErrors(err.details as Errors);
      }
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValues(EMPTY);
    setFiles({});
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setErrors({});
    setFormError(null);
    setFormKey((k) => k + 1);
  };

  const text = (field: keyof FormValues, label: string, props: Partial<FieldProps> & React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const { required, clean, className, ...input } = props;
    return (
      <Field label={label} required={required} error={errors[field]}>
        <input
          className={`${inputCls(errors[field])} ${className ?? ""}`}
          value={values[field]}
          onChange={set(field, clean)}
          {...input}
        />
      </Field>
    );
  };

  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      noValidate
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-5 lg:p-6"
    >
      {created && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <Icon name="checkCircle" className="size-5 shrink-0" />
          <span className="flex-1">
            Account opened for <b>{created.name}</b> — Account No. <b className="font-mono">{created.accountNo}</b>
            {" "}(Form No. <b className="font-mono">{created.formNo}</b>). Created by {created.createdBy}.
          </span>
          <button type="button" onClick={() => setCreated(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      {/* ---------------- Office ---------------- */}
      <OfficeBar isSuperAdmin={isSuperAdmin} officeId={officeId} error={errors.officeId} onChange={(id) => {
        setOfficeId(id);
        setErrors((err) => ({ ...err, officeId: undefined }));
      }} />

      {/* ---------------- Account holder ---------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon="user">Account Holder Details</SectionTitle>
        <span className="flex items-center gap-2 text-sm font-medium text-navy">
          Form No.
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-500">
            Auto-generated on save
          </span>
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_150px]">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {text("name", "Name", { required: true, placeholder: "Full name", autoComplete: "off" })}
          {text("fatherHusbandName", "Father's / Husband's Name", { placeholder: "Father's or husband's name" })}
          {text("dob", "DOB", { required: true, type: "date", max: new Date().toISOString().slice(0, 10) })}
          <Field label="Sex" required error={errors.sex}>
            <select
              className={`${inputCls(errors.sex)} ${values.sex ? "" : "text-slate-400"}`}
              value={values.sex}
              onChange={set("sex")}
            >
              <option value="" disabled>Select</option>
              {SEXES.map((s) => (
                <option key={s.value} value={s.value} className="text-slate-800">{s.label}</option>
              ))}
            </select>
          </Field>
          {text("mobileNumber", "Mob.", { required: true, inputMode: "numeric", placeholder: "10-digit mobile", clean: digits(10) })}
          {text("alternateMobileNumber", "Alternate Mob.", { inputMode: "numeric", placeholder: "Optional", clean: digits(10) })}
          {text("email", "E-mail", { type: "email", placeholder: "name@example.com" })}
          {text("panNo", "PAN No.", { required: true, placeholder: "ABCDE1234F", clean: upper(10), className: "font-mono" })}
          {text("aadhaarNo", "Aadhaar No.", { required: true, inputMode: "numeric", placeholder: "12-digit Aadhaar", clean: digits(12) })}
        </div>

        {/* Photograph */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-navy">
            Photograph<span className="text-red-500"> *</span>
          </span>
          <label
            className={`grid aspect-[35/45] w-full cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed bg-slate-50 text-center transition hover:border-brand/50 ${
              errors.photo ? "border-red-300" : photoUrl ? "border-emerald-300" : "border-slate-300"
            }`}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={photoUrl} alt="Account holder photograph" className="size-full object-cover" />
            ) : (
              <span className="px-2 text-xs text-slate-500">
                <Icon name="user" className="mx-auto mb-1 size-8 text-slate-400" />
                Passport size
                <span className="mt-1 block text-[10px]">JPG, PNG · max 1MB</span>
              </span>
            )}
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => pickFile("photo", e.target.files?.[0], PHOTO.types, PHOTO.maxMb)}
            />
          </label>
          {errors.photo && <span className="mt-1 block text-xs text-red-500">{errors.photo}</span>}
        </div>
      </div>

      {/* ---------------- Address ---------------- */}
      <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold text-navy">
          <Icon name="house" className="mr-1.5 inline size-4 text-brand" />
          Address
        </legend>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3">
          {text("houseNo", "Flat No. / Makan No.", { required: true, placeholder: "e.g. F-29, 1st Floor", clean: (v) => v.slice(0, 50) })}
          <Field label="Street / Locality / Area" required error={errors.address} className="sm:col-span-2">
            <input
              className={inputCls(errors.address)}
              placeholder="e.g. Gopal Nagar, Kewal Park Main Road"
              value={values.address}
              onChange={set("address", (v) => v.slice(0, 500))}
            />
          </Field>
          {text("city", "City", { required: true, placeholder: "City", clean: (v) => v.slice(0, 80) })}
          <Field label="State" required error={errors.state}>
            <select
              className={`${inputCls(errors.state)} ${values.state ? "" : "text-slate-400"}`}
              value={values.state}
              onChange={set("state")}
            >
              <option value="" disabled>Select State</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st} className="text-slate-800">{st}</option>
              ))}
            </select>
          </Field>
          {text("pincode", "PIN Code", { required: true, inputMode: "numeric", placeholder: "6-digit PIN", clean: digits(6) })}
        </div>
      </fieldset>

      <hr className="my-6 border-slate-100" />

      {/* ---------------- Bank details ---------------- */}
      <SectionTitle icon="wallet">Bank Details</SectionTitle>
      <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {text("bankName", "Bank Name", { placeholder: "Bank name" })}
        {text("bankAccountNo", "A/c No.", { inputMode: "numeric", placeholder: "Account number", clean: digits(18) })}
        {text("ifscCode", "IFSC Code", { placeholder: "SBIN0001234", clean: upper(11), className: "font-mono" })}
        {text("branch", "Branch", { placeholder: "Branch" })}
      </div>

      <hr className="my-6 border-slate-100" />
      <SectionTitle icon="wallet">Amount</SectionTitle>
      <div className="mt-5 max-w-md">
        {text("amount", "Amount (₹)", {
          required: true,
          inputMode: "decimal",
          placeholder: "e.g. 5000",
          clean: (v) => v.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"),
        })}
      </div>

      <hr className="my-6 border-slate-100" />
      <SectionTitle icon="wallet">Account Type</SectionTitle>
      <div className="mt-5 max-w-md">
        <Field label="Account Type" required error={errors.accountType}>
          <select
            className={`${inputCls(errors.accountType)} ${values.accountType ? "" : "text-slate-400"}`}
            value={values.accountType}
            onChange={set("accountType")}
          >
            <option value="" disabled>Select</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="text-slate-800">{t.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Installments fall due daily, every 7 days, or monthly, counted from the opening day.
      </p>

      <hr className="my-6 border-slate-100" />
      <SectionTitle icon="wallet">Interest</SectionTitle>
      <div className="mt-5 max-w-md">
        {text("interestRate", "Interest Rate (% per month)", {
          required: true,
          inputMode: "decimal",
          placeholder: "e.g. 0.75",
          clean: (v) => v.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"),
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Interest is calculated on the month-end balance and credited after the month closes.
      </p>

      <hr className="my-6 border-slate-100" />
      <SectionTitle icon="wallet">Buffer</SectionTitle>
      <div className="mt-5 max-w-md">
        {text("bufferDays", "Buffer Days (before fine)", {
          required: true,
          inputMode: "numeric",
          placeholder: "e.g. 5",
          clean: digits(2),
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Grace period after an installment falls due, before it is marked as fine applicable.
      </p>

      <hr className="my-6 border-slate-100" />

      {/* ---------------- Nominee ---------------- */}
      <SectionTitle icon="users">Nominee</SectionTitle>
      <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        {text("nomineeName", "Nominee Name", { placeholder: "Nominee's name" })}
        {text("nomineeAge", "Age", { inputMode: "numeric", placeholder: "Age", clean: digits(3) })}
        {text("nomineeRelation", "Relation", { placeholder: "e.g. Son" })}
      </div>

      <hr className="my-6 border-slate-100" />

      {/* ---------------- Sponsor ---------------- */}
      <SectionTitle icon="handCoins">Sponsor&apos;s Detail</SectionTitle>
      <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-3">
        {text("sponsorName", "Sponsor Name", { placeholder: "Sponsor's name" })}
        {text("sponsorMobile", "Mob.", { inputMode: "numeric", placeholder: "10-digit mobile", clean: digits(10) })}
        {text("sponsorId", "Sponsor ID", { placeholder: "Sponsor ID", clean: (v) => v.slice(0, 30) })}
      </div>

      {/* ---------------- Documents ---------------- */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-slate-50/70 p-4">
        <div className="mb-3 flex items-start gap-3">
          <Icon name="fileText" className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-navy">Documents</p>
            <p className="text-xs text-slate-600">Self-attested copies, as listed on the registration form</p>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {DOCUMENTS.map((doc) => {
            const file = files[doc.key];
            const err = errors[doc.key];
            return (
              <label
                key={doc.key}
                className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border border-dashed bg-white p-3 transition hover:border-brand/50 ${
                  err ? "border-red-300" : file ? "border-emerald-300" : "border-slate-300"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon name={file ? "check" : doc.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy">
                    {doc.label}<span className="text-red-500"> *</span>
                  </span>
                  <span className={`block break-words text-xs ${err ? "text-red-500" : file ? "text-emerald-700" : "text-slate-500"}`}>
                    {err ?? file?.name ?? doc.hint}
                  </span>
                </span>
                <span className="col-span-2 flex min-h-10 items-center justify-center rounded border border-slate-200 px-3 py-2 text-xs text-brand">
                  {file ? "Change" : "Choose file"}
                </span>
                <input
                  type="file"
                  accept={doc.accept}
                  className="sr-only"
                  onChange={(e) => pickFile(doc.key, e.target.files?.[0], doc.types, doc.maxMb)}
                />
              </label>
            );
          })}
        </div>
      </div>

      {formError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            reset();
            setCreated(null);
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-brand/50 px-7 text-sm font-medium text-brand hover:bg-brand-soft sm:h-10"
        >
          <Icon name="refresh" className="size-4" />
          Reset
        </button>
        <button
          type="submit"
          disabled={submitting || officeBlocked}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-7 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-70 sm:h-10"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.5} />
          {submitting ? "Saving…" : "Open Account"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ helpers ------------------------------ */

/**
 * Which office the account is opened at. The account number is
 * RS + that office's PIN code + a 6-digit counter, assigned on save.
 */
function OfficeBar({
  isSuperAdmin,
  officeId,
  error,
  onChange,
}: {
  isSuperAdmin: boolean;
  officeId: string;
  error?: string;
  onChange: (id: string) => void;
}) {
  const { user } = useAuth();
  if (isSuperAdmin) return <SuperAdminOfficePicker officeId={officeId} error={error} onChange={onChange} />;

  if (!user?.office) {
    return (
      <p role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Your account is not assigned to an office yet, so you can&apos;t open accounts. Ask the Super Admin to
        assign your office.
      </p>
    );
  }
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-slate-600">
        <Icon name="house" className="size-4 text-brand" />
        Office: <b className="text-navy">{officeLabel(user.office)}</b>
      </span>
      <AccountNoPreview pincode={user.office.pincode} />
    </div>
  );
}

function SuperAdminOfficePicker({
  officeId,
  error,
  onChange,
}: {
  officeId: string;
  error?: string;
  onChange: (id: string) => void;
}) {
  const { offices } = useOffices();
  const active = offices?.filter((o) => o.isActive) ?? [];
  const selected = active.find((o) => String(o.id) === officeId);
  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex w-full min-w-0 flex-wrap items-center gap-2 font-medium text-navy sm:w-auto">
          <Icon name="house" className="size-4 text-brand" />
          Office<span className="text-red-500">*</span>
          <select
            className={`${inputCls(error)} min-w-0 flex-1 sm:w-56 sm:flex-none font-normal ${officeId ? "" : "text-slate-400"}`}
            value={officeId}
            onChange={(e) => onChange(e.target.value)}
            disabled={!offices}
          >
            <option value="" disabled>
              {offices ? "Select office" : "Loading…"}
            </option>
            {active.map((o) => (
              <option key={o.id} value={o.id} className="text-slate-800">
                {officeLabel(o)} ({o.pincode})
              </option>
            ))}
          </select>
        </label>
        {selected && <AccountNoPreview pincode={selected.pincode} />}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function AccountNoPreview({ pincode }: { pincode: string }) {
  return (
    <span className="text-slate-600">
      Account No.: <b className="font-mono text-navy">RS{pincode}</b>
      <span className="font-mono text-slate-400">······</span>{" "}
      <span className="text-xs text-slate-500">(assigned on save)</span>
    </span>
  );
}

const inputCls = (error?: string) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-base text-slate-800 sm:text-sm outline-none placeholder:text-slate-400 focus:ring-2 ${
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-slate-200 focus:border-brand focus:ring-brand/15"
  }`;

function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold text-navy">
      <Icon name={icon} className="size-6 text-brand" />
      {children}
    </h2>
  );
}

type FieldProps = {
  required?: boolean;
  clean?: (v: string) => string;
};

function Field({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}
