/**
 * The account holder details shared by the Open Account form and the "Edit details" form
 * (at most 3 confirmed edits per account — enforced by customer-service / the database).
 * Field keys match the API (accounts.fn_holder_details); the backend validation is authoritative.
 */
import { INDIAN_STATES } from "@/lib/indianStates";

export type HolderDetailsForm = {
  name: string; // first (and middle) name; the full name is name + lastName
  lastName: string;
  fatherHusbandName: string;
  dob: string; // YYYY-MM-DD
  sex: string;
  mobileNumber: string;
  alternateMobileNumber: string;
  email: string;
  houseNo: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bankName: string;
  bankAccountNo: string;
  ifscCode: string;
  branch: string;
  nomineeName: string;
  nomineeAge: string;
  nomineeRelation: string;
};
export type HolderDetailsKey = keyof HolderDetailsForm;

export const SEXES = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export type HolderField = {
  key: HolderDetailsKey;
  label: string;
  section: "Account Holder" | "Address" | "Bank Details" | "Nominee";
  kind?: "date" | "sex" | "state";
  required?: boolean;
  mono?: boolean;
  /** input cleaner (same as the Open Account form) */
  clean?: (v: string) => string;
  inputMode?: "numeric" | "email";
  placeholder?: string;
};

const digits = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);
const upper = (max: number) => (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

/** Display order of the editable details (also the order of the review popups). */
export const HOLDER_FIELDS: HolderField[] = [
  { key: "name", label: "Name", section: "Account Holder", required: true, placeholder: "First (and middle) name" },
  { key: "lastName", label: "Last Name", section: "Account Holder", clean: (v) => v.slice(0, 80) },
  { key: "fatherHusbandName", label: "Father's / Husband's Name", section: "Account Holder" },
  { key: "dob", label: "DOB", section: "Account Holder", kind: "date", required: true },
  { key: "sex", label: "Sex", section: "Account Holder", kind: "sex", required: true },
  { key: "mobileNumber", label: "Mob.", section: "Account Holder", required: true, inputMode: "numeric", clean: digits(10), placeholder: "10-digit mobile" },
  { key: "alternateMobileNumber", label: "Alternate Mob.", section: "Account Holder", inputMode: "numeric", clean: digits(10), placeholder: "Optional" },
  { key: "email", label: "E-mail", section: "Account Holder", inputMode: "email", placeholder: "name@example.com" },
  { key: "houseNo", label: "Flat No. / Makan No.", section: "Address", required: true, clean: (v) => v.slice(0, 50) },
  { key: "address", label: "Street / Locality / Area", section: "Address", required: true, clean: (v) => v.slice(0, 500) },
  { key: "city", label: "City", section: "Address", required: true, clean: (v) => v.slice(0, 80) },
  { key: "state", label: "State", section: "Address", kind: "state", required: true },
  { key: "pincode", label: "PIN Code", section: "Address", required: true, inputMode: "numeric", clean: digits(6), mono: true },
  { key: "bankName", label: "Bank Name", section: "Bank Details" },
  { key: "bankAccountNo", label: "A/c No.", section: "Bank Details", inputMode: "numeric", clean: digits(18), mono: true },
  { key: "ifscCode", label: "IFSC Code", section: "Bank Details", clean: upper(11), mono: true, placeholder: "SBIN0001234" },
  { key: "branch", label: "Branch", section: "Bank Details" },
  { key: "nomineeName", label: "Nominee Name", section: "Nominee" },
  { key: "nomineeAge", label: "Age", section: "Nominee", inputMode: "numeric", clean: digits(3) },
  { key: "nomineeRelation", label: "Relation", section: "Nominee", placeholder: "e.g. Son" },
];

export const HOLDER_FIELD_LABEL = Object.fromEntries(HOLDER_FIELDS.map((f) => [f.key, f.label])) as Record<HolderDetailsKey, string>;

export const EMPTY_HOLDER_DETAILS: HolderDetailsForm = Object.fromEntries(HOLDER_FIELDS.map((f) => [f.key, ""])) as HolderDetailsForm;

/** Validation of the holder details — the same rules (and messages) as the Open Account form. */
export function validateHolderDetails(v: HolderDetailsForm): Partial<Record<HolderDetailsKey, string>> {
  const e: Partial<Record<HolderDetailsKey, string>> = {};
  if (!v.name.trim()) e.name = "Name is required";
  if (v.lastName.length > 80) e.lastName = "At most 80 characters";
  if (!v.houseNo.trim()) e.houseNo = "Flat No. / Makan No. is required";
  if (!v.address.trim()) e.address = "Address is required";
  if (!v.city.trim()) e.city = "City is required";
  if (!v.state || !INDIAN_STATES.includes(v.state)) e.state = "Select a state";
  if (!/^[1-9]\d{5}$/.test(v.pincode)) e.pincode = "Enter a valid 6-digit PIN code";
  if (!v.dob) e.dob = "Date of birth is required";
  if (!/^[6-9]\d{9}$/.test(v.mobileNumber)) e.mobileNumber = "Enter a valid 10-digit mobile number";
  if (v.alternateMobileNumber && !/^[6-9]\d{9}$/.test(v.alternateMobileNumber)) {
    e.alternateMobileNumber = "Enter a valid 10-digit mobile number";
  } else if (v.alternateMobileNumber && v.alternateMobileNumber === v.mobileNumber) {
    e.alternateMobileNumber = "Must be different from Mob.";
  }
  if (!v.sex) e.sex = "Select sex";
  if (v.bankAccountNo && !/^\d{9,18}$/.test(v.bankAccountNo)) e.bankAccountNo = "A/c No. must be 9–18 digits";
  if (v.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifscCode)) e.ifscCode = "Enter a valid IFSC (e.g. SBIN0001234)";
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = "Enter a valid email";
  if (v.nomineeAge && !(Number(v.nomineeAge) >= 0 && Number(v.nomineeAge) <= 120)) e.nomineeAge = "0–120";
  return e;
}

/** API details (nulls, numbers) → form strings. */
export function holderDetailsFromApi(current: Record<string, unknown>): HolderDetailsForm {
  return Object.fromEntries(HOLDER_FIELDS.map((f) => {
    const value = current[f.key];
    return [f.key, value === null || value === undefined ? "" : String(value)];
  })) as HolderDetailsForm;
}

/** Comparable form value: trimmed, e-mail in lower case (as the backend stores it). */
export const normalizedHolderValue = (key: HolderDetailsKey, value: string) => {
  const v = value.trim();
  return key === "email" ? v.toLowerCase() : v;
};

/** A value for the review popups / history. */
export function displayHolderValue(key: HolderDetailsKey, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const v = String(value);
  if (key === "sex") return SEXES.find((s) => s.value === v)?.label ?? v;
  if (key === "mobileNumber" || key === "alternateMobileNumber") return `+91 ${v}`;
  if (key === "nomineeAge") return `${v} yrs`;
  if (key === "dob" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return v;
}
