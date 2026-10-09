"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Field, Spinner, inputCls } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/auth/types";
import { money } from "@/lib/deposits/types";
import type { WithdrawalRules } from "@/lib/withdrawals/types";

type Values = {
  minDurationMonths: string;
  missedMonthPenalty: string;
  durationEnabled: boolean;
  monthlyDepositEnabled: boolean;
  missedPenaltyEnabled: boolean;
};
type Errors = Partial<Record<keyof Values, string>>;

const DURATION_PRESETS = [3, 6, 9, 12];

const toValues = (r: WithdrawalRules): Values => ({
  minDurationMonths: String(r.minDurationMonths),
  missedMonthPenalty: String(Number(r.missedMonthPenalty)),
  durationEnabled: r.durationEnabled,
  monthlyDepositEnabled: r.monthlyDepositEnabled,
  missedPenaltyEnabled: r.missedPenaltyEnabled,
});

/**
 * Super Admin → Withdrawal Rules: deposit-cycle duration, ₹ penalty per
 * missed month, and which rules are enforced. Stored in the database and
 * enforced by withdrawal-service / the stored procedures — this form only edits them.
 */
export function WithdrawalRulesForm() {
  const { authFetch } = useAuth();
  const [rules, setRules] = useState<WithdrawalRules | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<WithdrawalRules>("/api/withdrawals/rules", { signal: controller.signal }).then(
      (r) => {
        setRules(r);
        setValues(toValues(r));
      },
      (err) => {
        if ((err as Error).name !== "AbortError") setLoadError(errorMessage(err));
      },
    );
    return () => controller.abort();
  }, [authFetch]);

  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!rules || !values) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;

  const set = <K extends keyof Values>(field: K, value: Values[K]) => {
    setValues((v) => v && { ...v, [field]: value });
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
    setSaved(false);
  };

  const months = Number(values.minDurationMonths);
  const penalty = Number(values.missedMonthPenalty);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!/^\d{1,2}$/.test(values.minDurationMonths) || months < 1 || months > 60) {
      found.minDurationMonths = "Enter whole months from 1 to 60";
    }
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(values.missedMonthPenalty) || penalty > 100000) {
      found.missedMonthPenalty = "Enter an amount from ₹0 to ₹1,00,000 (max 2 decimals)";
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    if (
      !window.confirm(
        `Apply these withdrawal rules to every account now?\n\n` +
          `Deposit duration: ${months} months (${values.durationEnabled ? "enforced" : "off"})\n` +
          `Monthly deposit: ${values.monthlyDepositEnabled ? "required" : "off"}\n` +
          `Missed-month penalty: ${money(values.missedMonthPenalty)} (${values.missedPenaltyEnabled ? "charged" : "off"})`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const updated = await authFetch<WithdrawalRules>("/api/withdrawals/rules", {
        method: "PUT",
        body: { ...values, minDurationMonths: months },
      });
      setRules(updated);
      setValues(toValues(updated));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.details as Errors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">Withdrawal Rules</h1>
        <p className="text-sm text-slate-600">
          Deposit cycle and penalties every account must satisfy before a normal withdrawal. Changes apply at once to
          every current cycle and are recorded in the audit log.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {/* ---- duration ---- */}
        <RuleSection
          title="Minimum deposit duration"
          description="A normal withdrawal is allowed only after this many months from the first deposit — or from the last withdrawal, after which the cycle restarts."
          enabled={values.durationEnabled}
          onToggle={(v) => set("durationEnabled", v)}
        >
          <Field
            label="Duration (months)"
            required
            htmlFor="minDurationMonths"
            error={errors.minDurationMonths}
            hint={
              months >= 1 && months <= 60
                ? `e.g. first deposit 8 Oct 2026 → normal withdrawal from ${eligibleExample(months)}`
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="minDurationMonths"
                className={`${inputCls(errors.minDurationMonths)} max-w-32`}
                inputMode="numeric"
                maxLength={2}
                value={values.minDurationMonths}
                onChange={(e) => set("minDurationMonths", e.target.value.replace(/\D/g, ""))}
              />
              {DURATION_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("minDurationMonths", String(n))}
                  className={`h-9 rounded-lg border px-3 text-sm ${
                    months === n ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n} months
                </button>
              ))}
            </div>
          </Field>
        </RuleSection>

        {/* ---- monthly deposit ---- */}
        <RuleSection
          title="Mandatory monthly deposit"
          description="Every calendar month of the cycle needs at least one successful deposit, whatever the plan (daily, weekly or monthly). A month without one is a missed deposit month; only its penalty clears it."
          enabled={values.monthlyDepositEnabled}
          onToggle={(v) => set("monthlyDepositEnabled", v)}
        />

        {/* ---- penalty ---- */}
        <RuleSection
          title="Missed-month penalty"
          description="Charged for every missed deposit month and collected at the withdrawal desk (a separate receipt, never a deposit). No withdrawal is possible while a penalty is outstanding."
          enabled={values.missedPenaltyEnabled}
          onToggle={(v) => set("missedPenaltyEnabled", v)}
        >
          <Field
            label="Penalty per missed month (₹)"
            required
            htmlFor="missedMonthPenalty"
            error={errors.missedMonthPenalty}
            hint={
              Number.isFinite(penalty)
                ? `1 missed month = ${money(String(penalty))} · 2 = ${money(String(penalty * 2))} · 3 = ${money(String(penalty * 3))}`
                : undefined
            }
          >
            <input
              id="missedMonthPenalty"
              className={`${inputCls(errors.missedMonthPenalty)} max-w-48`}
              inputMode="decimal"
              value={values.missedMonthPenalty}
              onChange={(e) =>
                set("missedMonthPenalty", e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"))
              }
            />
          </Field>
        </RuleSection>

        <Alert tone="info">
          A withdrawal that doesn&apos;t meet the enforced rules is paid out as an <b>early withdrawal</b>:{" "}
          {Number(rules.earlyPenaltyRate)}% of the amount is deducted.
        </Alert>

        {formError && <Alert tone="error">{formError}</Alert>}
        {saved && <Alert tone="success">Rules saved — they now apply to every account.</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">
            {rules.updatedAt
              ? `Last changed ${formatDateTime(rules.updatedAt)}${rules.updatedBy ? ` by ${rules.updatedBy}` : ""}`
              : "Default rules"}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand px-7 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-70"
          >
            {saving ? <Spinner /> : <Icon name="check" className="size-4" />}
            {saving ? "Saving…" : "Save Rules"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** "8 Apr 2027" for a cycle starting 8 Oct 2026 (end-of-month clamped like the backend). */
function eligibleExample(months: number) {
  const index = 2026 * 12 + 9 + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const day = Math.min(8, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function RuleSection({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-navy">{title}</h2>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${title}: ${enabled ? "enforced" : "off"}`}
          onClick={() => onToggle(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-brand" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {children && <div className={enabled ? "" : "opacity-60"}>{children}</div>}
    </section>
  );
}
