"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Field, PasswordInput, Spinner, inputCls } from "@/components/auth/FormControls";
import { FullPageLoader } from "@/components/auth/RequireAuth";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/shell/Logo";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getCurrentLocation } from "@/lib/auth/location";
import { safeNext, type Coordinates, type OtpChallenge } from "@/lib/auth/types";

/** `location` is the position captured at the password step, re-sent with the OTP. */
type Challenge = Omit<OtpChallenge, "requiresOtp"> & {
  expiresAt: number;
  resendAt: number;
  location: Coordinates;
};

/** Codes that end the OTP step and send the user back to username/password. */
const RESTART_CODES = ["OTP_CHALLENGE_INVALID", "OTP_MAX_ATTEMPTS", "OTP_MAX_RESENDS"];

/** Ticks once a second while `active`, returning Date.now(). */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, login, verifyOtp, resendOtp } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(
    params.get("reason") === "expired" ? "Your session has expired. Please sign in again." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resending, setResending] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const now = useNow(!!challenge);

  // Already signed in (or just finished signing in) → leave the login page.
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    router.replace(user.mustChangePassword ? "/change-password" : safeNext(params.get("next"), user.role));
  }, [status, user, params, router]);

  useEffect(() => {
    if (challenge) otpRef.current?.focus();
  }, [challenge]);

  if (status === "loading" || status === "authenticated") {
    return <FullPageLoader label={status === "authenticated" ? "Signing you in…" : "Loading…"} />;
  }

  const restart = (message: string) => {
    setChallenge(null);
    setOtp("");
    setPassword("");
    setInfo(null);
    setError(message);
  };

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!username.trim()) found.username = "Enter your username or email";
    if (!password) found.password = "Enter your password";
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setError(null);
    let location: Coordinates;
    setLocating(true);
    try {
      location = await getCurrentLocation();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
      return;
    } finally {
      setLocating(false);
    }
    try {
      const result = await login(username.trim(), password, location);
      if (result.requiresOtp) {
        const t = Date.now();
        setChallenge({
          ...result,
          expiresAt: t + result.expiresIn * 1000,
          resendAt: t + result.resendAvailableIn * 1000,
          location,
        });
        setInfo(`We sent a 6-digit OTP to ${result.maskedMobile}.`);
      }
      // No OTP (Super Admin): the effect above redirects.
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFieldErrors(err.details);
      else setError(errorMessage(err));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: "Enter the 6-digit OTP" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(challenge.challengeId, otp, challenge.location);
      // Redirect handled by the effect above.
    } catch (err) {
      setOtp("");
      if (err instanceof ApiError && RESTART_CODES.includes(err.code)) {
        restart(err.message);
      } else if (err instanceof ApiError && err.code === "OTP_INVALID") {
        const left = err.body.attemptsRemaining ?? 0;
        setError(`Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`);
      } else {
        setError(errorMessage(err));
      }
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!challenge) return;
    setResending(true);
    setError(null);
    try {
      const result = await resendOtp(challenge.challengeId);
      const t = Date.now();
      setChallenge({
        ...challenge,
        maskedMobile: result.maskedMobile,
        expiresAt: t + result.expiresIn * 1000,
        resendAt: t + result.resendAvailableIn * 1000,
      });
      setOtp("");
      setInfo(`A new OTP was sent to ${result.maskedMobile}.`);
    } catch (err) {
      if (err instanceof ApiError && RESTART_CODES.includes(err.code)) restart(err.message);
      else if (err instanceof ApiError && err.code === "OTP_RESEND_COOLDOWN") {
        setChallenge({ ...challenge, resendAt: Date.now() + (err.body.retryAfter ?? 30) * 1000 });
        setError(err.message);
      } else setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const expiresIn = challenge ? challenge.expiresAt - now : 0;
  const resendIn = challenge ? challenge.resendAt - now : 0;

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#f4f7fc] to-[#e3edfb] px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-brand/5">
        <div className="flex justify-center">
          <Logo href="/login" />
        </div>

        {!challenge ? (
          <form onSubmit={handleCredentials} noValidate>
            <h1 className="mt-8 text-2xl font-bold text-navy">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-600">Sign in to the RS Group Society admin panel.</p>

            <div className="mt-6 space-y-4">
              {error && <Alert tone="error">{error}</Alert>}
              <Field label="Username or Email" error={fieldErrors.username} htmlFor="username">
                <input
                  id="username"
                  className={inputCls(fieldErrors.username)}
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setFieldErrors((f) => ({ ...f, username: "" }));
                  }}
                  placeholder="Enter your username"
                />
              </Field>
              <Field label="Password" error={fieldErrors.password} htmlFor="password">
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setFieldErrors((f) => ({ ...f, password: "" }));
                  }}
                  placeholder="Enter your password"
                  error={fieldErrors.password}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-70"
            >
              {submitting ? <Spinner /> : null}
              {locating ? "Getting your location…" : submitting ? "Verifying…" : "Continue"}
              {!submitting && <Icon name="arrowRight" className="size-4" />}
            </button>
            <p className="mt-6 text-center text-xs text-slate-500">
              Your location is recorded at every sign-in. Accounts are created by the Super Admin.
              Forgot your password? Contact your Super Admin.
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtp} noValidate>
            <span className="mx-auto mt-8 grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="phone" className="size-6" />
            </span>
            <h1 className="mt-4 text-center text-2xl font-bold text-navy">Verify it&apos;s you</h1>
            <p className="mt-1 text-center text-sm text-slate-600">
              Enter the OTP sent to <b className="text-navy">{challenge.maskedMobile}</b>
            </p>

            <div className="mt-6 space-y-4">
              {error ? <Alert tone="error">{error}</Alert> : info && <Alert tone="info">{info}</Alert>}
              <Field label="One-Time Password" error={fieldErrors.otp} htmlFor="otp">
                <input
                  id="otp"
                  ref={otpRef}
                  className={`${inputCls(fieldErrors.otp)} text-center font-mono text-xl tracking-[0.6em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setFieldErrors({});
                  }}
                  placeholder="••••••"
                />
              </Field>
              <p className={`text-center text-xs ${expiresIn > 0 ? "text-slate-500" : "text-red-600"}`}>
                {expiresIn > 0 ? `OTP expires in ${mmss(expiresIn)}` : "OTP expired — request a new one."}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "Verifying…" : "Verify & Sign In"}
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => restart("")}
                className="text-slate-600 hover:text-navy"
              >
                ← Use a different account
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0 || resending}
                className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {resending ? "Sending…" : resendIn > 0 ? `Resend in ${mmss(resendIn)}` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
