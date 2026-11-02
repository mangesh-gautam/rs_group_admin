"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Field, PasswordInput, Spinner, inputCls } from "@/components/auth/FormControls";
import { FullPageLoader } from "@/components/auth/RequireAuth";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/shell/Logo";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { FirebasePhoneLogin } from "@/lib/auth/firebasePhone";
import { getCurrentLocation } from "@/lib/auth/location";
import { safeNext, type Coordinates, type OtpChallenge } from "@/lib/auth/types";

/** `location` is the position captured at the password step, re-sent with the OTP. */
type Challenge = Omit<OtpChallenge, "requiresOtp"> & {
  expiresAt: number;
  resendAt: number;
  location: Coordinates;
};

/** Codes that end the OTP step and send the user back to username/password. */
const RESTART_CODES = ["OTP_CHALLENGE_INVALID", "OTP_MAX_ATTEMPTS", "OTP_MAX_RESENDS", "PHONE_VERIFICATION_INVALID"];

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

const resendsText = (n: number) =>
  n > 0 ? `${n} more resend${n === 1 ? "" : "s"} available.` : "No more resends for this sign-in.";

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
  const [smsSent, setSmsSent] = useState(false);
  // the last SMS request failed in the browser (Firebase): nothing reached the phone
  const [sendFailed, setSendFailed] = useState(false);
  const phoneLogin = useRef<FirebasePhoneLogin | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => phoneLogin.current?.dispose(), []);
  const otpRef = useRef<HTMLInputElement>(null);
  const now = useNow(!!challenge);

  // Already signed in (or just finished signing in) → leave the login page.
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    router.replace(user.mustChangePassword ? "/change-password" : safeNext(params.get("next"), user.role));
  }, [status, user, params, router]);

  useEffect(() => {
    if (challenge && smsSent) otpRef.current?.focus();
  }, [challenge, smsSent]);

  if (status === "loading" || status === "authenticated") {
    return <FullPageLoader label={status === "authenticated" ? "Signing you in…" : "Loading…"} />;
  }

  const restart = (message: string) => {
    phoneLogin.current?.dispose();
    phoneLogin.current=null;
    setChallenge(null);
    setOtp("");
    setSmsSent(false);
    setSendFailed(false);
    setFieldErrors({});
    setPassword("");
    setInfo(null);
    setError(message);
  };

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const found: Record<string, string> = {};
    if (!username.trim()) found.username = "Enter your username or email";
    if (!password) found.password = "Enter your password";
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    busyRef.current=true;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    let location: Coordinates;
    setLocating(true);
    try {
      location = await getCurrentLocation();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
      busyRef.current=false;
      return;
    } finally {
      setLocating(false);
    }
    try {
      const startedAt = Date.now();
      const result = await login(username.trim(), password, location);
      if (result.requiresOtp) {
        setPassword("");
        setSmsSent(false);
        setChallenge({
          ...result,
          expiresAt: startedAt + result.expiresIn * 1000,
          resendAt: startedAt + result.resendAvailableIn * 1000,
          location,
        });
        try {
          const { FirebasePhoneLogin } = await import("@/lib/auth/firebasePhone");
          phoneLogin.current?.dispose();
          phoneLogin.current = null;
          phoneLogin.current = new FirebasePhoneLogin();
          await phoneLogin.current.send(result.phoneNumber, "firebase-recaptcha");
          setSmsSent(true);
          setSendFailed(false);
          setInfo(`We sent a 6-digit OTP to ${result.maskedMobile}.`);
        } catch (err) {
          // The sign-in is still open: no SMS reached the phone, so "Send OTP again" works at once.
          setSendFailed(true);
          setError(`The OTP SMS could not be sent. ${errorMessage(err)}`);
        }
      }
      // Otherwise (an Admin already verified today) the session is applied and the
      // signed-in redirect above takes over. The Super Admin always verifies.
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFieldErrors(err.details);
      else setError(errorMessage(err));
      setPassword("");
    } finally {
      setSubmitting(false);
      busyRef.current=false;
    }
  };

  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge || !smsSent || !phoneLogin.current || busyRef.current) return;
    if (Date.now() >= challenge.expiresAt) {
      restart("Sign-in expired. Please sign in again.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: "Enter the 6-digit OTP" });
      return;
    }
    busyRef.current=true;
    setSubmitting(true);
    setError(null);
    try {
      const firebaseIdToken=await phoneLogin.current!.confirm(otp);
      await verifyOtp(challenge.challengeId, firebaseIdToken, challenge.location);
      phoneLogin.current?.dispose();
      // Redirect handled by the effect above.
    } catch (err) {
      if (!(err instanceof ApiError && (err.status >= 500 || err.code === "NETWORK_ERROR"))) setOtp("");
      if (err instanceof ApiError && RESTART_CODES.includes(err.code)) {
        restart(err.message);
      } else {
        setError(errorMessage(err));
      }
      otpRef.current?.focus();
    } finally {
      setSubmitting(false);
      busyRef.current=false;
    }
  };

  const handleResend = async () => {
    if (!challenge || busyRef.current) return;
    if (Date.now() >= challenge.expiresAt) {
      restart("Sign-in expired. Please sign in again.");
      return;
    }
    if (challenge.resendsLeft <= 0) return;
    if (!sendFailed && Date.now() < challenge.resendAt) return;
    busyRef.current=true;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const startedAt = Date.now();
      const result = await resendOtp(challenge.challengeId, sendFailed);
      // The server counts the resend before the browser sends; if this SMS fails too,
      // the next retry is again allowed at once (sendFailed) within the remaining resends.
      const next = {
        ...challenge,
        maskedMobile: result.maskedMobile,
        phoneNumber: result.phoneNumber,
        expiresAt: Math.min(challenge.expiresAt, startedAt + result.expiresIn * 1000),
        resendAt: startedAt + result.resendAvailableIn * 1000,
        resendsLeft: result.resendsLeft,
      };
      setChallenge(next);
      try {
        if (!phoneLogin.current) {
          const { FirebasePhoneLogin } = await import("@/lib/auth/firebasePhone");
          phoneLogin.current = new FirebasePhoneLogin();
        }
        await phoneLogin.current.send(result.phoneNumber, "firebase-recaptcha");
      } catch (err) {
        setSendFailed(true);
        setError(`The OTP SMS could not be sent. ${errorMessage(err)}`);
        return;
      }
      setSmsSent(true);
      setSendFailed(false);
      setOtp("");
      setFieldErrors({});
      setInfo(`A new OTP was sent to ${result.maskedMobile}. ${resendsText(result.resendsLeft)}`);
    } catch (err) {
      if (err instanceof ApiError && RESTART_CODES.includes(err.code)) restart(err.message);
      else if (err instanceof ApiError && err.code === "OTP_RESEND_COOLDOWN") {
        setChallenge({ ...challenge, resendAt: Date.now() + (err.body.retryAfter ?? 30) * 1000 });
        setError(err.message);
      } else setError(errorMessage(err));
    } finally {
      setResending(false);
      busyRef.current=false;
    }
  };

  const expiresIn = challenge ? challenge.expiresAt - now : 0;
  // after a failed SMS the retry is allowed at once; otherwise the server's cooldown applies
  const resendIn = challenge && !sendFailed ? challenge.resendAt - now : 0;
  const noResends = !!challenge && challenge.resendsLeft <= 0;
  const resendLabel = resending
    ? "Sending…"
    : noResends
      ? "No resends left"
      : resendIn > 0
        ? `Resend in ${mmss(resendIn)}`
        : `${smsSent && !sendFailed ? "Resend OTP" : "Send OTP again"} (${challenge?.resendsLeft} left)`;

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#f4f7fc] to-[#e3edfb] px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-brand/5">
        <div id="firebase-recaptcha" />
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
              Continue to receive a verification SMS on your registered number. Firebase/Google processes this number for phone verification and abuse prevention. Your location is recorded at every sign-in. Accounts are created by the Super Admin.
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
              {smsSent && !sendFailed ? "Enter the OTP sent to " : "Send a verification code to "}
              <b className="text-navy">{challenge.maskedMobile}</b>
            </p>

            <div className="mt-6 space-y-4">
              {error ? <Alert tone="error">{error}</Alert> : info && <Alert tone="info">{info}</Alert>}
              {sendFailed && expiresIn > 0 && (
                noResends ? (
                  <Alert tone="error">No more OTP resends for this sign-in. Use “Use a different account” and sign in again with your password to get a new OTP.</Alert>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || submitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand-soft text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-60"
                  >
                    {resending ? <Spinner /> : <Icon name="refresh" className="size-4" />}
                    {resending ? "Sending…" : `Send OTP again to ${challenge.maskedMobile} (${challenge.resendsLeft} left)`}
                  </button>
                )
              )}
              <Field label="One-Time Password" error={fieldErrors.otp} htmlFor="otp">
                <input
                  id="otp"
                  ref={otpRef}
                  className={`${inputCls(fieldErrors.otp)} text-center font-mono text-xl tracking-[0.6em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={!smsSent || submitting || resending || expiresIn <= 0}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setFieldErrors({});
                  }}
                  placeholder="••••••"
                />
              </Field>
              <p className={`text-center text-xs ${expiresIn > 0 ? "text-slate-500" : "text-red-600"}`}>
                {expiresIn > 0 ? `Sign-in expires in ${mmss(expiresIn)}` : "Sign-in expired. Go back and sign in again."}
              </p>
            </div>

            <button
              type="submit"
              disabled={!smsSent || submitting || resending || expiresIn <= 0 || otp.length !== 6}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "Verifying…" : "Verify & Sign In"}
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={submitting || resending}
                onClick={() => restart("")}
                className="text-slate-600 hover:text-navy"
              >
                ← Use a different account
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0 || resending || submitting || expiresIn <= 0 || noResends}
                className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {resendLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
