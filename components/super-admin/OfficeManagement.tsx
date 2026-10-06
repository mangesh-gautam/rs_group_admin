"use client";

import { useState, type FormEvent } from "react";
import { Alert, Field, Spinner, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { officeLabel, type Office } from "@/lib/auth/types";
import { INDIAN_STATES } from "@/lib/indianStates";
import { useOffices } from "@/lib/offices/useOffices";

type Values = { name: string; city: string; state: string; pincode: string; address: string };
type Errors = Partial<Record<keyof Values, string>>;
const EMPTY: Values = { name: "", city: "", state: "", pincode: "", address: "" };

/** Super Admin → Offices: office locations that Admins are assigned to. */
export function OfficeManagement() {
  const { authFetch } = useAuth();
  const { offices, error, loading, reload } = useOffices();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Office | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof Values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!values.name.trim()) found.name = "Office name / area is required";
    if (!values.city.trim()) found.city = "City is required";
    if (!values.state) found.state = "Select a state";
    if (!/^[1-9]\d{5}$/.test(values.pincode)) found.pincode = "Enter a valid 6-digit PIN code";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setCreated(null);
    try {
      const office = await authFetch<Office>("/api/super-admin/offices", { method: "POST", body: values });
      setCreated(office);
      setValues(EMPTY);
      reload();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "VALIDATION_ERROR" || err.code === "CONFLICT")) {
        setErrors(err.details as Errors);
      }
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">Super Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">Offices</h1>
        <p className="mt-1 text-sm text-slate-600">
          Office locations shown in the Office dropdown when you create an admin.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white">
          {error ? (
            <div className="p-4">
              <Alert tone="error">
                {error}{" "}
                <button type="button" onClick={reload} className="font-medium underline">
                  Retry
                </button>
              </Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Office</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">PIN Code</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 text-right font-medium">Admins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading &&
                    Array.from({ length: 2 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {offices?.map((o) => (
                    <tr key={o.id} className={o.isActive ? "" : "text-slate-400"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{officeLabel(o)}</p>
                        {!o.isActive && <p className="text-xs">Inactive</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{o.state}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{o.pincode}</td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-600">{o.address ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy">{o.adminCount}</td>
                    </tr>
                  ))}
                  {offices && offices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                        No offices yet. Add the first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <Icon name="plusCircle" className="size-5 text-brand" /> Add Office
          </h2>
          {created && <Alert tone="success">{officeLabel(created)} added.</Alert>}
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="City" required error={errors.city} htmlFor="office-city">
            <input
              id="office-city"
              className={inputCls(errors.city)}
              placeholder="e.g. Delhi"
              maxLength={80}
              value={values.city}
              onChange={(e) => set("city")(e.target.value)}
            />
          </Field>
          <Field label="Office / Area" required error={errors.name} htmlFor="office-name">
            <input
              id="office-name"
              className={inputCls(errors.name)}
              placeholder="e.g. Azadpur"
              maxLength={100}
              value={values.name}
              onChange={(e) => set("name")(e.target.value)}
            />
          </Field>
          <Field label="State" required error={errors.state} htmlFor="office-state">
            <select
              id="office-state"
              className={`${inputCls(errors.state)} ${values.state ? "" : "text-slate-400"}`}
              value={values.state}
              onChange={(e) => set("state")(e.target.value)}
            >
              <option value="" disabled>
                Select state
              </option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st} className="text-slate-800">
                  {st}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="PIN Code"
            required
            error={errors.pincode}
            htmlFor="office-pincode"
            hint="Account numbers opened here start with RS + this PIN code"
          >
            <input
              id="office-pincode"
              className={`${inputCls(errors.pincode)} font-mono`}
              placeholder="e.g. 110033"
              inputMode="numeric"
              value={values.pincode}
              onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </Field>
          <Field label="Address" optional error={errors.address} htmlFor="office-address">
            <textarea
              id="office-address"
              rows={2}
              maxLength={300}
              className={`${inputCls(errors.address)} h-auto resize-none py-2`}
              placeholder="Full office address"
              value={values.address}
              onChange={(e) => set("address")(e.target.value)}
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-70"
          >
            {submitting ? <Spinner /> : <Icon name="plus" className="size-4" />}
            {submitting ? "Adding…" : "Add Office"}
          </button>
        </form>
      </div>
    </div>
  );
}
