"use client";

import { useEffect, useState } from "react";
import { Alert, Field, Spinner, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";

type Settings = { editWindowHours: number; updatedAt: string | null; updatedBy: string | null };
const PRESETS = [24, 48, 72, 168];

/**
 * Super Admin Settings → how long after it was made a deposit or withdrawal can
 * still be edited or deleted by the Super Admin (GET/PUT /api/admin/settings/transactions).
 * Admins can never change a transaction.
 */
export function TransactionCorrectionSettings() {
  const { authFetch } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hours, setHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<Settings>("/api/admin/settings/transactions", { signal: controller.signal }).then(
      (s) => { setSettings(s); setHours(String(s.editWindowHours)); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(undefined);
    setSaved(false);
    try {
      const s = await authFetch<Settings>("/api/admin/settings/transactions", { method: "PUT", body: { editWindowHours: Number(hours) } });
      setSettings(s);
      setHours(String(s.editWindowHours));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.details.editWindowHours) setFieldError(err.details.editWindowHours);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changed = settings && hours !== String(settings.editWindowHours);
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="clipboard" className="size-5 text-brand" /> Transaction corrections
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Only the Super Admin can edit or delete a deposit or withdrawal, and only for this long after it was made.
          Admins can never change a transaction. A month whose interest is already posted stays locked.
        </p>
      </div>
      <form onSubmit={save} noValidate className="space-y-4 px-5 py-4 sm:px-6">
        {!settings && !error && <div className="h-20 animate-pulse rounded-lg bg-slate-100" />}
        {settings && (
          <>
            <Field label="Correction window (hours)" required htmlFor="edit-window" error={fieldError}
              hint={`${Number(hours) >= 24 && Number(hours) % 24 === 0 ? `${Number(hours) / 24} day${Number(hours) === 24 ? "" : "s"} · ` : ""}1 to 720 hours`}>
              <div className="flex flex-wrap items-center gap-2">
                <input id="edit-window" inputMode="numeric" value={hours} disabled={saving}
                  onChange={(e) => { setHours(e.target.value.replace(/\D/g, "").slice(0, 3)); setSaved(false); }}
                  className={`${inputCls(fieldError)} max-w-32`} />
                {PRESETS.map((h) => (
                  <button key={h} type="button" disabled={saving} onClick={() => { setHours(String(h)); setSaved(false); }}
                    className={`h-9 rounded-full border px-3 text-xs font-medium ${hours === String(h) ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} h`}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {settings.updatedBy ? `Last changed by ${settings.updatedBy}${settings.updatedAt ? ` on ${formatDateTime(settings.updatedAt)}` : ""}` : "Default setting"}
              </p>
              <button type="submit" disabled={saving || !changed}
                className="flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
                {saving && <Spinner />} Save
              </button>
            </div>
          </>
        )}
        {saved && <Alert tone="success">Saved — transactions can now be corrected for {settings?.editWindowHours} hours after they were made.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </form>
    </section>
  );
}
