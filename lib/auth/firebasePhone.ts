"use client";

import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  RecaptchaVerifier,
  setPersistence,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { ApiError } from "./api";

/** Firebase supplies temporary phone proof; the backend owns application sessions. */
export class FirebasePhoneLogin {
  private verifier: RecaptchaVerifier | null = null;
  private confirmation: ConfirmationResult | null = null;
  private token: string | null = null;
  private disposed = false;
  private readonly auth;

  constructor() {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (Object.values(config).some((value) => !value)) {
      throw new ApiError(503, "PHONE_AUTH_UNAVAILABLE", "Phone verification is not configured. Contact your administrator.");
    }
    const app = getApps().find((app) => app.name === "rs-group-phone") ?? initializeApp(config, "rs-group-phone");
    this.auth = getAuth(app);
  }

  async send(phoneNumber: string, container: string) {
    if (this.disposed) {
      throw new ApiError(400, "FIREBASE_PHONE_ERROR", "Sign-in cancelled. Please sign in again.");
    }
    if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
      throw new ApiError(400, "FIREBASE_PHONE_ERROR", "The account's registered phone number is invalid.");
    }
    this.verifier?.clear();
    this.verifier = null;
    try {
      await setPersistence(this.auth, inMemoryPersistence);
      await signOut(this.auth);
      if (this.disposed) throw new Error("Sign-in cancelled");
      this.verifier = new RecaptchaVerifier(this.auth, container, { size: "invisible" });
      const confirmation = await signInWithPhoneNumber(this.auth, phoneNumber, this.verifier);
      if (this.disposed) throw new Error("Sign-in cancelled");
      this.confirmation = confirmation;
      this.token = null;
    } catch (err) {
      this.verifier?.clear();
      this.verifier = null;
      console.warn("Firebase SMS request failed:", (err as { code?: string }).code ?? "UNKNOWN");
      throw new ApiError(400, "FIREBASE_PHONE_ERROR", firebasePhoneError(err));
    }
  }

  async confirm(code: string): Promise<string> {
    if (this.disposed || !this.confirmation) {
      throw new ApiError(400, "FIREBASE_PHONE_ERROR", "Request an OTP first.");
    }
    // Retry a failed backend request without consuming the Firebase OTP twice.
    if (this.token) return this.token;
    try {
      const result = await this.confirmation.confirm(code);
      const token = await result.user.getIdToken(true);
      if (this.disposed) throw new Error("Sign-in cancelled");
      this.token = token;
      return token;
    } catch (err) {
      console.warn("Firebase OTP confirmation failed:", (err as { code?: string }).code ?? "UNKNOWN");
      throw new ApiError(400, "FIREBASE_PHONE_ERROR", firebasePhoneError(err));
    } finally {
      await signOut(this.auth).catch(() => {});
    }
  }

  dispose() {
    this.disposed = true;
    this.verifier?.clear();
    this.verifier = null;
    this.confirmation = null;
    this.token = null;
    void signOut(this.auth).catch(() => {});
  }
}

/** A message for the person signing in; the Firebase code is appended so problems can be diagnosed. */
function firebasePhoneError(err: unknown): string {
  const code = (err as { code?: string }).code ?? "unknown";
  return `${firebasePhoneMessage(code)} (${code})`;
}

function firebasePhoneMessage(code: string): string {
  const onLocalhost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  switch (code) {
    case "auth/invalid-verification-code": return "Incorrect OTP. Check the code and try again.";
    case "auth/code-expired":
    case "auth/session-expired": return "The Firebase OTP expired. Request a new code.";
    case "auth/too-many-requests": return "Too many verification requests. Wait before trying again.";
    case "auth/captcha-check-failed": return "The security check failed. Please try again.";
    case "auth/unauthorized-domain": return "Phone verification is not enabled for this website. Contact your administrator.";
    case "auth/quota-exceeded": return "SMS verification is temporarily unavailable. Contact your administrator.";
    case "auth/billing-not-enabled": return "Firebase SMS billing is not enabled (the project needs the Blaze plan). Contact your administrator.";
    case "auth/operation-not-allowed": return "Phone sign-in is disabled, or SMS to this country is blocked by the Firebase SMS region policy. Contact your administrator.";
    case "auth/invalid-app-credential":
    case "auth/missing-app-credential":
      return onLocalhost
        ? "Firebase rejected this browser check on localhost. Real SMS sign-in only works on the authorized login domain — for local testing add this number as a Firebase test phone number."
        : "Firebase could not verify this website. Use the authorized login domain and try again.";
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number": return "The account's registered mobile number is not valid for SMS. Ask the Super Admin to correct it.";
    case "auth/internal-error": return "Firebase had an internal problem sending the SMS. Please try again.";
    case "auth/admin-restricted-operation": return "Phone sign-in is restricted for this Firebase project. Contact your administrator.";
    case "auth/app-not-authorized": return "This website is not authorized for Firebase phone sign-in. Contact your administrator.";
    case "auth/invalid-api-key": return "Firebase phone verification configuration is invalid. Contact your administrator.";
    case "auth/network-request-failed": return "Unable to reach Firebase. Check your connection and try again.";
    default: return "Unable to complete phone verification. Please try again.";
  }
}
