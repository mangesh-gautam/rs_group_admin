/**
 * Member-portal passwords set by an Admin (opening an account, or a new password later).
 * Mirrors @rs-group/common PasswordPolicy — the API checks again and is authoritative.
 * The password never comes back from the API: the Admin types (or generates) it here,
 * hands it to the holder. It stays valid; a forgotten one is reset by the member (OTP) or the office.
 */
export const MEMBER_PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "At least one letter", test: (pw) => /[A-Za-z]/.test(pw) },
  { label: "At least one number", test: (pw) => /\d/.test(pw) },
  { label: "At least one special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const memberPasswordProblems = (pw: string) =>
  [...MEMBER_PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label), ...(pw.length > 128 ? ["At most 128 characters"] : [])];

/** A strong, readable initial password (no look-alikes such as 0/O, 1/l/I), made in the browser. */
export function suggestMemberPassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$%&*"];
  const all = sets.join("");
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = sets.map(pick);
  while (chars.length < 10) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
