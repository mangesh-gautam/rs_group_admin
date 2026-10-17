"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DocumentViewer } from "@/components/accounts/DocumentViewer";
import { Alert, Field, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { formatAadhaar, type DocumentKind, type KycStatus, type KycTarget } from "@/lib/accounts/types";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { KycDocState, KycStatusBadge } from "./KycStatusBadge";

const DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_MB = 2;

type Errors = Partial<Record<"mobileNumber" | "panNo" | "panCard" | "aadhaarNo" | "aadhaarCard" | "remarks", string>>;
type Result = { status: KycStatus; panKyc: boolean; aadhaarKyc: boolean };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * KYC of one account, used from the account page and the KYC page.
 *  - SUBMITTED: the uploaded documents are shown; the admin approves or
 *    rejects them (a rejection needs the reason).
 *  - PENDING / REJECTED: the admin uploads the missing PAN and / or Aadhaar
 *    (number + copy) and confirms the mobile number. "Originals checked"
 *    verifies them at once; otherwise they wait for approval.
 * Calls onDone after a change so the caller reloads the account.
 */
export function KycDialog({ account, onClose, onDone }: { account: KycTarget; onClose: () => void; onDone: (r: Result) => void }) {
  const [mode, setMode] = useState<"review" | "upload">(account.status === "SUBMITTED" ? "review" : "upload");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="kyc-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="kyc-title" className="flex flex-wrap items-center gap-2 font-semibold text-navy">
              <Icon name="shieldCheck" className="size-5 text-brand" /> KYC · {account.name}
              <KycStatusBadge status={account.status} />
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{account.accountNo}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <Icon name="x" className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {account.status === "REJECTED" && account.remarks && (
            <div className="mb-4">
              <Alert tone="error">Last upload was rejected: {account.remarks}</Alert>
            </div>
          )}
          {mode === "review" ? (
            <ReviewKyc account={account} onDone={onDone} onUploadAgain={() => setMode("upload")} />
          ) : (
            <UploadKyc account={account} onDone={onDone} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ review (SUBMITTED) ------------------------------ */

function ReviewKyc({ account, onDone, onUploadAgain }: { account: KycTarget; onDone: (r: Result) => void; onUploadAgain: () => void }) {
  const { authFetch } = useAuth();
  const [viewing, setViewing] = useState<DocumentKind | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const review = async (approve: boolean) => {
    if (!approve && !remarks.trim()) {
      setError("Write the reason for rejecting, so the holder knows what to upload again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch<Result>(`/api/customers/account-holders/${encodeURIComponent(account.accountNo)}/kyc/review`, {
        method: "POST",
        body: { approve, remarks: approve ? undefined : remarks.trim() },
      });
      onDone(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const docs: { kind: DocumentKind; label: string; number: string | null; verified: boolean }[] = [
    { kind: "panCard", label: "PAN", number: account.panNo, verified: account.panKyc },
    { kind: "aadhaarCard", label: "Aadhaar", number: account.aadhaarNo ? formatAadhaar(account.aadhaarNo) : null, verified: account.aadhaarKyc },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Check the uploaded documents against the holder&apos;s details, then approve or reject them.
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {docs.map((d) => (
          <li key={d.kind} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy">{d.label}</p>
              <p className="font-mono text-xs text-slate-600">{d.number ?? "—"}</p>
              <KycDocState number={d.number} verified={d.verified} />
            </div>
            {d.number && (
              <button type="button" onClick={() => setViewing(d.kind)} className="flex h-9 items-center gap-2 rounded-lg border border-brand/40 px-3 text-sm font-medium text-brand hover:bg-brand-soft">
                <Icon name="eye" className="size-4" /> View copy
              </button>
            )}
          </li>
        ))}
        <li className="px-4 py-3 text-sm">
          <span className="text-slate-500">Mobile:</span> <span className="font-medium text-navy">+91 {account.mobileNumber}</span>
        </li>
      </ul>

      {rejecting && (
        <Field label="Reason for rejecting" required error={undefined}>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="e.g. Aadhaar copy is blurred — upload a clear copy"
            className={`${inputCls()} h-auto py-2`}
          />
        </Field>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onUploadAgain} className="text-sm font-medium text-brand hover:underline">
          Upload different documents
        </button>
        <div className="flex gap-2">
          {rejecting ? (
            <>
              <button type="button" onClick={() => setRejecting(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm text-navy hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={busy} onClick={() => review(false)} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                {busy ? "Saving…" : "Reject documents"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setRejecting(true)} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50">Reject</button>
              <button type="button" disabled={busy} onClick={() => review(true)} className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                <Icon name="checkCircle" className="size-4" /> {busy ? "Saving…" : "Approve KYC"}
              </button>
            </>
          )}
        </div>
      </div>

      {viewing && (
        <DocumentViewer accountNo={account.accountNo} kind={viewing} title={`${viewing === "panCard" ? "PAN" : "Aadhaar"} copy — ${account.name}`} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

/* ------------------------------ upload (PENDING / REJECTED) ------------------------------ */

function UploadKyc({ account, onDone }: { account: KycTarget; onDone: (r: Result) => void }) {
  const { authFetch } = useAuth();
  const needPan = !account.panKyc;
  const needAadhaar = !account.aadhaarKyc;
  const [mobileNumber, setMobileNumber] = useState(account.mobileNumber);
  const [panNo, setPanNo] = useState(needPan ? account.panNo ?? "" : "");
  const [aadhaarNo, setAadhaarNo] = useState(needAadhaar ? account.aadhaarNo ?? "" : "");
  const [files, setFiles] = useState<{ panCard?: File; aadhaarCard?: File }>({});
  const [approve, setApprove] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (key: "panCard" | "aadhaarCard", file?: File) => {
    const problem = !file ? undefined : !DOC_TYPES.includes(file.type) ? "JPG, PNG or PDF only" : file.size > MAX_MB * 1024 * 1024 ? `At most ${MAX_MB}MB` : undefined;
    setFiles((f) => ({ ...f, [key]: problem ? undefined : file }));
    setErrors((e) => ({ ...e, [key]: problem }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) found.mobileNumber = "Enter a valid 10-digit mobile number";
    if (panNo && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNo)) found.panNo = "Enter a valid PAN (e.g. ABCDE1234F)";
    if (panNo && !files.panCard) found.panCard = "Upload the PAN card copy";
    if (!panNo && files.panCard) found.panNo = "Enter the PAN of this copy";
    if (aadhaarNo && !/^[2-9]\d{11}$/.test(aadhaarNo)) found.aadhaarNo = "Enter a valid 12-digit Aadhaar number";
    if (aadhaarNo && !files.aadhaarCard) found.aadhaarCard = "Upload the Aadhaar card copy";
    if (!aadhaarNo && files.aadhaarCard) found.aadhaarNo = "Enter the Aadhaar number of this copy";
    if (!panNo && !aadhaarNo && !files.panCard && !files.aadhaarCard) setFormError("Upload PAN and / or Aadhaar.");
    else setFormError(null);
    setErrors(found);
    if (Object.keys(found).length || (!panNo && !aadhaarNo)) return;

    setBusy(true);
    try {
      const [panCard, aadhaarCard] = await Promise.all([
        files.panCard ? readAsDataUrl(files.panCard) : undefined,
        files.aadhaarCard ? readAsDataUrl(files.aadhaarCard) : undefined,
      ]);
      const r = await authFetch<Result>(`/api/customers/account-holders/${encodeURIComponent(account.accountNo)}/kyc`, {
        method: "POST",
        body: {
          mobileNumber,
          ...(panNo ? { panNo, panCard } : {}),
          ...(aadhaarNo ? { aadhaarNo, aadhaarCard } : {}),
          approve,
        },
      });
      onDone(r);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors((err.details ?? {}) as Errors);
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const fileBox = (key: "panCard" | "aadhaarCard", label: string) => (
    <label className={`relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-white p-3 hover:border-brand/50 ${errors[key] ? "border-red-300" : files[key] ? "border-emerald-300" : "border-slate-300"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={files[key] ? "check" : key === "panCard" ? "creditCard" : "idCard"} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-navy">{label} copy</span>
        <span className={`block truncate text-xs ${errors[key] ? "text-red-600" : files[key] ? "text-emerald-700" : "text-slate-500"}`}>
          {errors[key] ?? files[key]?.name ?? "JPG, PNG or PDF · max 2MB"}
        </span>
      </span>
      <span className="rounded border border-slate-200 px-2.5 py-1 text-xs text-brand">{files[key] ? "Change" : "Choose"}</span>
      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(e) => pick(key, e.target.files?.[0])} />
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-slate-600">
        Upload the missing documents. Until KYC is verified this account can deposit but cannot withdraw.
      </p>

      <Field label="Mobile number" required error={errors.mobileNumber} htmlFor="kyc-mobile">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">+91</span>
          <input id="kyc-mobile" inputMode="numeric" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls(errors.mobileNumber)} />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-navy">PAN</legend>
          {needPan ? (
            <>
              <Field label="PAN No." error={errors.panNo} htmlFor="kyc-pan">
                <input id="kyc-pan" value={panNo} placeholder="ABCDE1234F" onChange={(e) => setPanNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} className={`${inputCls(errors.panNo)} font-mono`} />
              </Field>
              {fileBox("panCard", "PAN card")}
            </>
          ) : (
            <p className="text-sm text-emerald-700">✓ Verified · <span className="font-mono">{account.panNo}</span></p>
          )}
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-navy">Aadhaar</legend>
          {needAadhaar ? (
            <>
              <Field label="Aadhaar No." error={errors.aadhaarNo} htmlFor="kyc-aadhaar">
                <input id="kyc-aadhaar" inputMode="numeric" value={aadhaarNo} placeholder="12-digit Aadhaar" onChange={(e) => setAadhaarNo(e.target.value.replace(/\D/g, "").slice(0, 12))} className={`${inputCls(errors.aadhaarNo)} font-mono`} />
              </Field>
              {fileBox("aadhaarCard", "Aadhaar card")}
            </>
          ) : (
            <p className="text-sm text-emerald-700">✓ Verified · <span className="font-mono">{formatAadhaar(account.aadhaarNo)}</span></p>
          )}
        </fieldset>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
        <span>
          <span className="font-medium text-navy">I have checked the original documents — verify now</span>
          <span className="block text-xs text-slate-500">Untick to send them for approval instead.</span>
        </span>
      </label>

      {formError && <Alert tone="error">{formError}</Alert>}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
          <Icon name="upload" className="size-4" /> {busy ? "Uploading…" : approve ? "Upload & verify" : "Upload for approval"}
        </button>
      </div>
    </form>
  );
}
