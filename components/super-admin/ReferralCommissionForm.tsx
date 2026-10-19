"use client";

import { FormSkeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { money } from "@/lib/deposits/types";
import {
  LEVEL_LABEL,
  commissionFor,
  rateLabel,
  type CommissionConfig,
  type CommissionLevel,
  type CommissionType,
} from "@/lib/referral/types";

type Values = { enabled: boolean; includeOpeningDeposit: boolean; levels: CommissionLevel[] };

const toValues = (c: CommissionConfig): Values => ({
  enabled: c.enabled,
  includeOpeningDeposit: c.includeOpeningDeposit,
  levels: c.levels.map((l) => ({ ...l, value: String(Number(l.value)) })),
});

/**
 * Super Admin → Referral Commission: for each of the 5 upline levels, a % of
 * the deposit or a fixed ₹ amount per deposit, and on / off; plus the master
 * switch and whether opening amounts count. Read by the database at the moment
 * of every deposit — changes apply to deposits made after saving.
 */
export function ReferralCommissionForm() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [example, setExample] = useState("10000");

  useEffect(() => {
    const controller = new AbortController();
    authFetch<CommissionConfig>("/api/deposits/commission-config", { signal: controller.signal }).then(
      (c) => { setConfig(c); setValues(toValues(c)); },
      (err) => { if ((err as Error).name !== "AbortError") setLoadError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch]);

  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!config || !values) return <SkeletonRegion label="Loading commission settings…"><FormSkeleton fields={6} /></SkeletonRegion>;

  const touch = () => { setFormError(null); setSaved(false); };
  const setLevel = (level: number, patch: Partial<CommissionLevel>) => {
    setValues((v) => v && { ...v, levels: v.levels.map((l) => (l.level === level ? { ...l, ...patch } : l)) });
    setErrors((e) => ({ ...e, [`level${level}`]: "", levels: "" }));
    touch();
  };

  const levelError = (l: CommissionLevel) =>
    !/^\d{1,7}(\.\d{1,2})?$/.test(l.value)
      ? l.type === "PERCENT" ? "Enter a % (max 2 decimals)" : "Enter ₹ (max 2 decimals)"
      : l.type === "PERCENT" && Number(l.value) > 100 ? "At most 100%" : "";
  const percentTotal = values.levels.filter((l) => l.active && l.type === "PERCENT").reduce((s, l) => s + (Number(l.value) || 0), 0);
  const exampleAmount = Math.max(0, Number(example) || 0);
  const shares = values.levels.map((l) => ({ ...l, amount: commissionFor(l, exampleAmount) }));
  const exampleTotal = shares.reduce((s, l) => s + l.amount, 0);
  const amountAboveDeposit = shares.some((l) => l.active && l.type === "AMOUNT" && l.amount > exampleAmount && exampleAmount > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    for (const l of values.levels) { const m = levelError(l); if (m) found[`level${l.level}`] = m; }
    if (!Object.keys(found).length && percentTotal > 100) found.levels = `The active % levels add up to ${percentTotal}% — at most 100%`;
    setErrors(found);
    if (Object.keys(found).length) { setFormError(found.levels ?? "Please correct the highlighted levels."); return; }
    if (!window.confirm(
      `Apply these referral commission settings to every deposit from now on?\n\n` +
      (values.enabled ? values.levels.map((l) => `Level ${l.level}: ${l.active ? rateLabel(l.type, l.value) : "off"}`).join("\n") : "Commission switched OFF") +
      (values.enabled ? `\nOpening amount: ${values.includeOpeningDeposit ? "earns commission" : "no commission"}` : ""),
    )) return;

    setSaving(true);
    try {
      const updated = await authFetch<CommissionConfig>("/api/deposits/commission-config", { method: "PUT", body: values });
      setConfig(updated);
      setValues(toValues(updated));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors((err.details ?? {}) as Record<string, string>);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">Referral Commission</h1>
        <p className="text-sm text-slate-600">
          When a member makes a deposit, their sponsors up to 5 levels above earn commission. Set each level as a
          percentage of the deposit or a fixed amount per deposit. Changes apply to deposits made after you save and
          are recorded in the audit log.
        </p>
        {config.updatedAt && (
          <p className="mt-1 text-xs text-slate-500">Last changed {formatDateTime(config.updatedAt)}{config.updatedBy ? ` by ${config.updatedBy}` : ""}</p>
        )}
      </div>

      {saved && <Alert tone="success">Commission settings saved — they apply to every deposit from now on.</Alert>}

      <form onSubmit={submit} noValidate className="space-y-5">
        {/* ---- switches ---- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle
            title="Referral commission"
            description={values.enabled ? "On — deposits pay commission to the upline." : "Off — no commission is created for any deposit."}
            checked={values.enabled}
            onChange={(v) => { setValues({ ...values, enabled: v }); touch(); }}
          />
          <Toggle
            title="Commission on the opening amount"
            description={values.includeOpeningDeposit ? "The amount paid when an account is opened also earns commission." : "Only deposits after opening earn commission."}
            checked={values.includeOpeningDeposit}
            disabled={!values.enabled}
            onChange={(v) => { setValues({ ...values, includeOpeningDeposit: v }); touch(); }}
          />
        </div>

        {/* ---- levels ---- */}
        <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${values.enabled ? "" : "opacity-60"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-navy"><Icon name="users" className="size-5 text-brand" /> Commission per level</h2>
            <span className={`text-xs font-medium ${percentTotal > 100 ? "text-red-600" : "text-slate-500"}`}>
              % levels total: {percentTotal}% {percentTotal > 100 ? "— more than 100%" : "of each deposit"}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {values.levels.map((l) => {
              const err = errors[`level${l.level}`] || "";
              return (
                <li key={l.level} className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto]">
                  <div>
                    <p className="font-medium text-navy">Level {l.level}</p>
                    <p className="text-xs text-slate-500">{LEVEL_LABEL[l.level]}</p>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label={`Level ${l.level} commission type`}>
                    {(["PERCENT", "AMOUNT"] as CommissionType[]).map((t) => (
                      <button key={t} type="button" role="radio" aria-checked={l.type === t} disabled={!values.enabled}
                        onClick={() => setLevel(l.level, { type: t })}
                        className={`h-8 rounded-md px-3 text-sm font-medium ${l.type === t ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                        {t === "PERCENT" ? "% of deposit" : "₹ per deposit"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="sr-only" htmlFor={`level-${l.level}`}>Level {l.level} value</label>
                    <div className={`flex h-10 items-center rounded-lg border bg-white px-3 focus-within:ring-2 focus-within:ring-brand/20 ${err ? "border-red-300" : "border-slate-200"}`}>
                      {l.type === "AMOUNT" && <span className="mr-1 text-sm text-slate-500">₹</span>}
                      <input id={`level-${l.level}`} inputMode="decimal" value={l.value} disabled={!values.enabled || !l.active}
                        onChange={(e) => setLevel(l.level, { value: e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1") })}
                        className="w-full bg-transparent text-sm font-semibold text-navy tabular-nums outline-none disabled:text-slate-400" />
                      {l.type === "PERCENT" && <span className="ml-1 text-sm text-slate-500">%</span>}
                    </div>
                    {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={l.active} disabled={!values.enabled}
                      onChange={(e) => setLevel(l.level, { active: e.target.checked })} className="size-4 accent-[var(--color-brand)]" />
                    {l.active ? "On" : "Off"}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- example ---- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-navy">Example</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              A member deposits
              <span className="flex h-9 items-center rounded-lg border border-slate-200 px-2">
                ₹<input inputMode="numeric" value={example} onChange={(e) => setExample(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  className="w-24 bg-transparent px-1 text-sm font-semibold text-navy tabular-nums outline-none" aria-label="Example deposit amount" />
              </span>
            </label>
          </div>
          <ol className="mt-4 space-y-2">
            {shares.map((l) => (
              <li key={l.level} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">
                  <b className="text-navy">Level {l.level}</b> · {LEVEL_LABEL[l.level]} ·{" "}
                  {values.enabled && l.active ? rateLabel(l.type, l.value || "0") : "off"}
                </span>
                <span className={`font-semibold tabular-nums ${values.enabled && l.amount > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                  {money(String(values.enabled ? l.amount : 0))}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-600">Total paid to the upline (when all 5 sponsors exist)</span>
            <b className="text-navy tabular-nums">{money(String(values.enabled ? exampleTotal : 0))}</b>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            A level is paid only if that sponsor exists — with 2 sponsors above, only levels 1 and 2 are paid; the rest goes to nobody.
            Fixed ₹ amounts are paid on every deposit, including small daily ones.
          </p>
          {amountAboveDeposit && (
            <div className="mt-3"><Alert tone="warning">A fixed ₹ level pays more than this deposit itself.</Alert></div>
          )}
        </section>

        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-60">
            <Icon name="check" className="size-4" /> {saving ? "Saving…" : "Save commission settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Toggle({ title, description, checked, disabled, onChange }: {
  title: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border bg-white p-4 ${checked ? "border-brand/40" : "border-slate-200"} ${disabled ? "opacity-60" : ""}`}>
      <span>
        <span className="block font-semibold text-navy">{title}</span>
        <span className="block text-xs text-slate-600">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" />
    </label>
  );
}
