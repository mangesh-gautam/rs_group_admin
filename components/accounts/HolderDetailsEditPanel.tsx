"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { Field, inputCls } from "@/components/open-account/OpenAccountForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  HOLDER_FIELDS,
  HOLDER_FIELD_LABEL,
  SEXES,
  displayHolderValue,
  holderDetailsFromApi,
  normalizedHolderValue,
  validateHolderDetails,
  type HolderDetailsForm,
  type HolderDetailsKey,
} from "@/lib/accounts/holderDetails";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { INDIAN_STATES } from "@/lib/indianStates";

type Change = { field: HolderDetailsKey; old: unknown; new: unknown };
type EditSummary = {
  accountNo: string;
  editsUsed: number;
  editsMax: number;
  editsRemaining: number;
  canEdit: boolean;
  closed: boolean;
  current: Record<string, unknown>;
  history: { editNo: number; editedAt: string; editedBy: string; changes: Change[] }[];
};
type Saved = { editNo: number; editsUsed: number; editsRemaining: number; changes: Change[] };

const SECTIONS = ["Account Holder", "Address", "Bank Details", "Nominee"] as const;

/**
 * Account page → the holder's details may be edited at most 3 times (confirmed edits).
 * Edit → the details form, pre-filled → Review changes → a popup with every detail, changed
 * ones highlighted (old → new) → Confirm Changes. Only that saves (and counts); cancelling,
 * closing or invalid data changes nothing. The limit is enforced by the backend and database.
 */
export function HolderDetailsEditPanel({ accountNo, onSaved }: { accountNo: string; onSaved: () => void }) {
  const { authFetch } = useAuth();
  const [summary, setSummary] = useState<EditSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [step, setStep] = useState<"closed" | "edit" | "review">("closed");
  const [values, setValues] = useState<HolderDetailsForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<HolderDetailsKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // set synchronously: a fast double click can't send the edit twice before `saving` re-renders
  const savingRef = useRef(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<EditSummary>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/edits`, { signal: controller.signal })
      .then((s) => { setSummary(s); setLoadError(null); }, (err) => {
        if ((err as Error).name !== "AbortError") setLoadError(errorMessage(err));
      });
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  const original = summary ? holderDetailsFromApi(summary.current) : null;
  const changed = (key: HolderDetailsKey) =>
    !!original && !!values && normalizedHolderValue(key, original[key]) !== normalizedHolderValue(key, values[key]);
  const changedKeys = HOLDER_FIELDS.map((f) => f.key).filter(changed);

  const openEditor = () => {
    if (!summary?.canEdit || !original) return;
    setValues(original);
    setErrors({});
    setFormError(null);
    setNotice(null);
    setStep("edit");
  };
  // Cancel at any point: the pending changes are dropped, the saved account is untouched
  const cancel = () => {
    if (saving) return;
    setStep("closed");
    setValues(null);
    setErrors({});
    setFormError(null);
  };

  const review = () => {
    if (!values) return;
    const found = validateHolderDetails(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    if (!changedKeys.length) {
      setFormError("Nothing was changed. Change a detail, or cancel.");
      return;
    }
    setFormError(null);
    setStep("review");
  };

  const confirm = async () => {
    if (!values || !summary || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await authFetch<Saved>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}/details`, {
        method: "PUT",
        // expectedEdits: the count this form was loaded with — the server refuses it if someone edited meanwhile
        body: { expectedEdits: summary.editsUsed, details: values },
      });
      setStep("closed");
      setValues(null);
      setNotice({
        tone: "success",
        text: `Edit ${saved.editNo} of ${summary.editsMax} saved (${saved.changes.length} detail${saved.changes.length === 1 ? "" : "s"} changed). ${
          saved.editsRemaining ? `${saved.editsRemaining} edit${saved.editsRemaining === 1 ? "" : "s"} remaining.` : "No edits remaining."}`,
      });
      setVersion((v) => v + 1);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        // back to the form with the server's messages next to the fields
        setErrors(err.details as Partial<Record<HolderDetailsKey, string>>);
        setFormError(errorMessage(err));
        setStep("edit");
      } else if (err instanceof ApiError && (err.code === "EDITED_MEANWHILE" || err.code === "EDIT_LIMIT_REACHED")) {
        // the saved account changed: drop the pending edit and show the current state
        setStep("closed");
        setValues(null);
        setNotice({ tone: "error", text: errorMessage(err) });
        setVersion((v) => v + 1);
        onSaved();
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const set = (key: HolderDetailsKey, clean?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = clean ? clean(e.target.value) : e.target.value;
      setValues((v) => (v ? { ...v, [key]: value } : v));
      setErrors((x) => ({ ...x, [key]: undefined }));
    };

  const limitReached = !!summary && summary.editsUsed >= summary.editsMax;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="holder-edit-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="holder-edit-title" className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="user" className="size-5 text-brand" /> Edit Account Holder Details
        </h2>
        <button type="button" onClick={openEditor} disabled={!summary?.canEdit}
          title={limitReached ? "Maximum edit limit reached" : summary?.closed ? "The account is closed" : undefined}
          className="flex h-9 items-center gap-2 rounded-lg border border-brand/40 px-3 text-sm font-medium text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent">
          <Icon name="edit" className="size-4" /> Edit
        </button>
      </div>

      {loadError && <Alert tone="error">{loadError}</Alert>}
      {notice && <div className="mb-3"><Alert tone={notice.tone}>{notice.text}</Alert></div>}

      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Edits Used</dt>
              <dd className="mt-1 font-semibold text-navy">{summary.editsUsed}/{summary.editsMax}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Edits Remaining</dt>
              <dd className={`mt-1 font-semibold ${summary.editsRemaining ? "text-navy" : "text-red-600"}`}>{summary.editsRemaining}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Last Edit</dt>
              <dd className="mt-1 text-navy">
                {summary.history[0] ? `Edit ${summary.history[0].editNo} · ${formatDateTime(summary.history[0].editedAt)} by ${summary.history[0].editedBy}` : "Never edited"}
              </dd>
            </div>
          </dl>
          {limitReached && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Maximum edit limit reached. This account can no longer be edited.
            </p>
          )}
          {!limitReached && summary.closed && (
            <p className="mt-3 text-sm text-slate-600">This account is closed, so its details can&apos;t be edited.</p>
          )}
          {!limitReached && !summary.closed && (
            <p className="mt-3 text-xs text-slate-500">
              Personal, contact, address, bank and nominee details can be corrected up to {summary.editsMax} times. PAN, Aadhaar and
              documents are updated on the KYC page; the amount and account terms can&apos;t be edited.
            </p>
          )}

          {summary.history.length > 0 && (
            <div className="mt-4">
              <button type="button" onClick={() => setShowHistory((s) => !s)} className="text-sm font-medium text-brand hover:underline" aria-expanded={showHistory}>
                {showHistory ? "Hide" : "Show"} edit history ({summary.history.length})
              </button>
              {showHistory && (
                <ol className="mt-3 space-y-3">
                  {summary.history.map((h) => (
                    <li key={h.editNo} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-navy">Edit {h.editNo} <span className="font-normal text-slate-500">· {formatDateTime(h.editedAt)} · by {h.editedBy}</span></p>
                      <ul className="mt-2 space-y-1">
                        {h.changes.map((c) => (
                          <li key={c.field} className="flex flex-wrap gap-x-2 text-slate-700">
                            <span className="text-slate-500">{HOLDER_FIELD_LABEL[c.field] ?? c.field}:</span>
                            <span className="text-slate-500 line-through">{displayHolderValue(c.field, c.old)}</span>
                            <span aria-hidden="true">→</span>
                            <span className="font-medium text-navy">{displayHolderValue(c.field, c.new)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}

      {/* ---- step 1: the details form, pre-filled ---- */}
      {step === "edit" && values && summary && (
        <ConfirmDialog
          title="Edit account holder details"
          subtitle={`${accountNo} · edit ${summary.editsUsed + 1} of ${summary.editsMax} — nothing is saved until you confirm`}
          icon="edit"
          wide
          busy={false}
          confirmLabel={`Review changes${changedKeys.length ? ` (${changedKeys.length})` : ""}`}
          busyLabel="Review changes"
          backLabel="Cancel"
          onConfirm={review}
          onBack={cancel}
        >
          {formError && <div className="mb-4"><Alert tone="error">{formError}</Alert></div>}
          <div className="space-y-5">
            {SECTIONS.map((section) => (
              <fieldset key={section}>
                <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{section}</legend>
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  {HOLDER_FIELDS.filter((f) => f.section === section).map((f) => (
                    <Field key={f.key} label={`${f.label}${changed(f.key) ? " · changed" : ""}`} required={f.required} error={errors[f.key]}
                      className={f.key === "address" ? "sm:col-span-2" : ""}>
                      {f.kind === "sex" || f.kind === "state" ? (
                        <select className={`${inputCls(errors[f.key])} ${changed(f.key) ? "border-amber-400 bg-amber-50" : ""}`} value={values[f.key]} onChange={set(f.key)}>
                          <option value="" disabled>Select</option>
                          {(f.kind === "sex" ? SEXES : INDIAN_STATES.map((st) => ({ value: st, label: st }))).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={`${inputCls(errors[f.key])} ${f.mono ? "font-mono" : ""} ${changed(f.key) ? "border-amber-400 bg-amber-50" : ""}`}
                          type={f.kind === "date" ? "date" : f.inputMode === "email" ? "email" : "text"}
                          inputMode={f.inputMode === "numeric" ? "numeric" : undefined}
                          max={f.kind === "date" ? new Date().toISOString().slice(0, 10) : undefined}
                          placeholder={f.placeholder}
                          value={values[f.key]}
                          onChange={set(f.key, f.clean)}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </ConfirmDialog>
      )}

      {/* ---- step 2: confirm — every detail, the changed ones old → new ---- */}
      {step === "review" && values && original && summary && (
        <ConfirmDialog
          title="Confirm the changes"
          subtitle={`${accountNo} · this will be edit ${summary.editsUsed + 1} of ${summary.editsMax}${summary.editsRemaining === 1 ? " — the last one allowed" : ""}`}
          icon="checkCircle"
          wide
          busy={saving}
          confirmLabel="Confirm Changes"
          busyLabel="Saving…"
          backLabel="Go Back"
          onConfirm={confirm}
          onBack={() => setStep("edit")}
          extra={(
            <button type="button" onClick={cancel} disabled={saving}
              className="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
              Cancel
            </button>
          )}
        >
          {formError && <div className="mb-4"><Alert tone="error">{formError}</Alert></div>}
          <p className="mb-3 text-sm text-slate-700">
            Verify that all information is correct. <b>{changedKeys.length}</b> detail{changedKeys.length === 1 ? "" : "s"} will change
            (highlighted). After saving, {summary.editsRemaining - 1} edit{summary.editsRemaining - 1 === 1 ? "" : "s"} will remain.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr><th className="px-3 py-2 font-medium">Detail</th><th className="px-3 py-2 font-medium">Current (saved)</th><th className="px-3 py-2 font-medium">After this edit</th></tr>
              </thead>
              <tbody>
                {HOLDER_FIELDS.map((f) => {
                  const isChanged = changed(f.key);
                  return (
                    <tr key={f.key} className={`border-t border-slate-100 ${isChanged ? "bg-amber-50" : ""}`}>
                      <td className="px-3 py-2 text-slate-600">
                        {f.label}
                        {isChanged && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 uppercase">Changed</span>}
                      </td>
                      <td className={`px-3 py-2 ${isChanged ? "text-slate-500 line-through" : "text-navy"} ${f.mono ? "font-mono" : ""}`}>{displayHolderValue(f.key, original[f.key])}</td>
                      <td className={`px-3 py-2 ${isChanged ? "font-semibold text-navy" : "text-slate-500"} ${f.mono ? "font-mono" : ""}`}>{displayHolderValue(f.key, values[f.key].trim())}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
