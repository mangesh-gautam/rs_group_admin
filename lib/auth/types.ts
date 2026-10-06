export type Role = "SUPER_ADMIN" | "ADMIN";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

/** Device coordinates captured at sign-in (accuracy in metres). */
export type Coordinates = { latitude: number; longitude: number; accuracy: number | null };

/** The only user data the UI keeps in memory (no hashes, no tokens). */
export type AuthUser = {
  id: string; // auto-increment from 1001: "1001", "1002" …
  fullName: string;
  username: string;
  email: string;
  mobileNumber: string; // masked
  employeeId: string | null;
  office: OfficeRef | null;
  role: Role;
  mustChangePassword: boolean;
  mobileVerified: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
};

export type AuthSuccess = {
  requiresOtp: false;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
};

export type OtpChallenge = {
  requiresOtp: true;
  challengeId: string;
  maskedMobile: string;
  expiresIn: number;
  resendAvailableIn: number;
};

export type OtpResend = Omit<OtpChallenge, "requiresOtp" | "challengeId">;

/** Admin record as returned by /api/super-admin/admins. */
export type AdminAccount = {
  id: string; // auto-increment from 1001: "1001", "1002" …
  fullName: string;
  username: string;
  email: string;
  mobileNumber: string;
  employeeId: string | null;
  office: OfficeRef | null;
  role: "ADMIN";
  status: AccountStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  mobileVerified: boolean;
  temporarilyLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginLocation: Coordinates | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
};

/** Landing page for each role after sign-in. */
export const homeFor = (role: Role) =>
  role === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/admin/dashboard";

/** Which route trees a role may open (backend still enforces every API). */
export const canAccessPath = (role: Role, path: string) =>
  path.startsWith("/super-admin") ? role === "SUPER_ADMIN" : true;

/** Only same-site, role-permitted paths are honoured as ?next= targets. */
export function safeNext(next: string | null, role: Role) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return homeFor(role);
  }
  return canAccessPath(role, next) ? next : homeFor(role);
}

export const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** An Admin signed in right now, from /api/super-admin/sessions/active. */
export type ActiveSession = {
  sessionId: string;
  admin: { id: string; fullName: string; username: string; employeeId: string | null };
  signedInAt: string;
  lastActiveAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  location: Coordinates | null;
};

export type ActiveSessionsResponse = { windowSeconds: number; sessions: ActiveSession[] };

/** An office location from /api/super-admin/offices. */
export type Office = {
  id: number;
  name: string;
  city: string;
  state: string;
  pincode: string; // 6 digits; part of every account number opened here
  address: string | null;
  isActive: boolean;
  adminCount: number;
  createdAt: string;
};

export type OfficeRef = Pick<Office, "id" | "name" | "city" | "pincode">;

/** "Delhi – Azadpur" */
export const officeLabel = (o: Pick<Office, "name" | "city"> | null) => (o ? `${o.city} – ${o.name}` : "Not assigned");
