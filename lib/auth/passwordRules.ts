// Mirrors the backend policy (auth-service src/lib/validation.ts). The backend
// is authoritative — this only gives instant feedback while typing.
export const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "At least one letter", test: (pw) => /[A-Za-z]/.test(pw) },
  { label: "At least one number", test: (pw) => /\d/.test(pw) },
  { label: "At least one special character (@, #, $ …)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const isStrongPassword = (pw: string) =>
  pw.length <= 128 && PASSWORD_RULES.every((r) => r.test(pw));
