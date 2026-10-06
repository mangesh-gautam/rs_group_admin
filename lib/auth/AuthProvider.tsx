"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "./api";
import type { AuthSuccess, AuthUser, Coordinates, OtpChallenge, OtpResend } from "./types";

/**
 * Client-side authentication state.
 *
 *  - Access token  → kept ONLY in memory (a ref), never in localStorage.
 *  - Refresh token → HttpOnly cookie set by auth-service; JS can't read it.
 *  - On load, POST /api/auth/refresh restores the session from that cookie.
 *  - The access token is refreshed shortly before it expires and after any 401.
 *  - Logout in one tab signs out every tab (BroadcastChannel).
 */

type Status = "loading" | "authenticated" | "unauthenticated";
type EndReason = "expired" | "signedOut" | null;

type AuthState = {
  status: Status;
  user: AuthUser | null;
  /**
   * Why the last session ended: "expired" (revoked / timed out → login shows a
   * banner and returns to the page) or "signedOut" (explicit logout → plain login).
   */
  endReason: EndReason;
};

type ChangePasswordResult = { user: AuthUser; revokedSessions: number };

type AuthContextValue = AuthState & {
  login: (username: string, password: string, location: Coordinates) => Promise<AuthSuccess | OtpChallenge>;
  verifyOtp: (challengeId: string, otp: string, location: Coordinates) => Promise<AuthUser>;
  resendOtp: (challengeId: string) => Promise<OtpResend>;
  logout: () => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<ChangePasswordResult>;
  /** fetch() for protected APIs: adds the Bearer token, refreshes once on 401. */
  authFetch: <T>(
    path: string,
    options?: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal },
  ) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// One refresh at a time per tab (StrictMode double effects, parallel 401s).
let refreshInFlight: Promise<AuthSuccess | null> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requestRefresh() {
  refreshInFlight ??= (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await apiRequest<AuthSuccess>("/api/auth/refresh", { method: "POST" });
      } catch (err) {
        // Another tab rotated the cookie a moment ago → retry with the new one.
        if (err instanceof ApiError && err.code === "REFRESH_RACE") {
          await sleep(300 * (attempt + 1));
          continue;
        }
        if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) throw err;
        return null; // 401/403: no valid session
      }
    }
    return null;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    endReason: null,
  });
  const tokenRef = useRef<string | null>(null);
  const statusRef = useRef<Status>("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const refreshRef = useRef<() => Promise<boolean>>(async () => false);

  const clearSession = useCallback((endReason: EndReason) => {
    tokenRef.current = null;
    clearTimeout(timerRef.current);
    setState({ status: "unauthenticated", user: null, endReason });
  }, []);

  const applySession = useCallback((result: AuthSuccess) => {
    tokenRef.current = result.accessToken;
    clearTimeout(timerRef.current);
    // Refresh one minute before the access token expires.
    const inMs = Math.max(10, result.expiresIn - 60) * 1000;
    timerRef.current = setTimeout(() => void refreshRef.current(), inMs);
    setState({ status: "authenticated", user: result.user, endReason: null });
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const result = await requestRefresh();
      if (result) {
        applySession(result);
        return true;
      }
      clearSession(statusRef.current === "authenticated" ? "expired" : null);
      return false;
    } catch {
      // Network / server down: keep the current state and try again soon.
      setState((s) => (s.status === "loading" ? { ...s, status: "unauthenticated" } : s));
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void refreshRef.current(), 30_000);
      return false;
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    refreshRef.current = refreshSession;
  }, [refreshSession]);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  // Restore the session on first load + listen for logout from other tabs.
  useEffect(() => {
    let cancelled = false;
    requestRefresh().then(
      (result) => {
        if (cancelled) return;
        if (result) applySession(result);
        else clearSession(null);
      },
      () => {
        if (cancelled) return;
        // Server unreachable: show the login page; retry in the background.
        clearSession(null);
        timerRef.current = setTimeout(() => void refreshRef.current(), 30_000);
      },
    );
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("rs-auth");
      channel.onmessage = (e) => {
        if (e.data === "logout") clearSession("signedOut");
      };
      channelRef.current = channel;
    }
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      channelRef.current?.close();
    };
  }, [applySession, clearSession]);

  const authFetch = useCallback(
    async <T,>(
      path: string,
      options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
    ): Promise<T> => {
      const call = () => apiRequest<T>(path, { ...options, token: tokenRef.current });
      try {
        return await call();
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        if (err.status === 401 && (await refreshSession())) return call();
        if (err.status === 401 || err.code === "ACCOUNT_INACTIVE") clearSession("expired");
        if (err.code === "PASSWORD_CHANGE_REQUIRED") {
          setState((s) => (s.user ? { ...s, user: { ...s.user, mustChangePassword: true } } : s));
        }
        throw err;
      }
    },
    [refreshSession, clearSession],
  );

  const login = useCallback(
    async (username: string, password: string, location: Coordinates) => {
      const result = await apiRequest<AuthSuccess | OtpChallenge>("/api/auth/login", {
        method: "POST",
        body: { username, password, location },
      });
      if (!result.requiresOtp) applySession(result);
      return result;
    },
    [applySession],
  );

  const verifyOtp = useCallback(
    async (challengeId: string, otp: string, location: Coordinates) => {
      const result = await apiRequest<AuthSuccess>("/api/auth/verify-otp", {
        method: "POST",
        body: { challengeId, otp, location },
      });
      applySession(result);
      return result.user;
    },
    [applySession],
  );

  const resendOtp = useCallback(
    (challengeId: string) =>
      apiRequest<OtpResend>("/api/auth/resend-otp", { method: "POST", body: { challengeId } }),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/api/auth/logout", { method: "POST", token: tokenRef.current });
    } catch {
      /* the local session is cleared regardless */
    }
    clearSession("signedOut");
    channelRef.current?.postMessage("logout");
  }, [clearSession]);

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      const result = await authFetch<ChangePasswordResult>("/api/auth/change-password", {
        method: "POST",
        body: input,
      });
      setState((s) => ({ ...s, user: result.user }));
      return result;
    },
    [authFetch],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, verifyOtp, resendOtp, logout, changePassword, authFetch }),
    [state, login, verifyOtp, resendOtp, logout, changePassword, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
