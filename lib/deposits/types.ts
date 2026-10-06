/** Types for the deposit-service API (/api/deposits). Amounts are decimal strings. */

export type DepositMode = "CASH" | "UPI" | "CHEQUE" | "BANK_TRANSFER";

export const DEPOSIT_MODES: { value: DepositMode; label: string; reference?: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI", reference: "UPI transaction / UTR no." },
  { value: "CHEQUE", label: "Cheque", reference: "Cheque no." },
  { value: "BANK_TRANSFER", label: "Bank transfer (NEFT / IMPS / RTGS)", reference: "UTR / transaction no." },
];

/** Interest is credited by the system (mode SYSTEM), never entered by an admin. */
export type LedgerMode = DepositMode | "SYSTEM";

export const modeLabel = (m: LedgerMode) =>
  m === "SYSTEM" ? "System" : (DEPOSIT_MODES.find((x) => x.value === m)?.label ?? m);

/** Installment frequency, chosen when the account is opened. Interest is monthly for every type. */
export type AccountType = "DAILY" | "WEEKLY" | "MONTHLY";

export const ACCOUNT_TYPES: { value: AccountType; label: string; hint: string }[] = [
  { value: "DAILY", label: "Daily", hint: "Installment due every day" },
  { value: "WEEKLY", label: "Weekly", hint: "Installment due every 7 days" },
  { value: "MONTHLY", label: "Monthly", hint: "Installment due every month on the opening day" },
];

export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

/** Interest / installment terms set when the account is opened. */
export type AccountTerms = {
  openedOn: string; // YYYY-MM-DD — installments and monthly interest count from this day
  accountType: AccountType;
  interestRate: string; // % per month, e.g. "0.75"
  bufferDays: number; // grace days after each due date before a fine applies
};

/** GET /api/deposits/accounts/:accountNo */
export type DepositAccount = {
  accountNo: string;
  name: string;
  fatherHusbandName: string | null;
  mobileNumber: string;
  city: string;
  office: { name: string; city: string };
  photo: string; // data URL
  balance: string;
  totalDeposited: string;
  depositCount: number;
  lastDepositAt: string | null;
  totalInterest: string;
  terms: AccountTerms;
  nextDueOn: string | null; // YYYY-MM-DD
  finesApplicable: number; // installments not paid within their buffer
};

/** POST /api/deposits → 201 */
export type DepositReceipt = {
  receiptNo: string;
  accountNo: string;
  name: string;
  amount: string;
  mode: DepositMode;
  referenceNo: string | null;
  remarks: string | null;
  balance: string; // balance after this deposit
  depositedAt: string;
  createdBy: string;
};

/** Row of GET /api/deposits */
export type DepositEntry = {
  receiptNo: string;
  accountNo: string;
  name: string;
  amount: string;
  balanceAfter: string; // account balance right after this entry (derived, not stored)
  kind: "OPENING" | "DEPOSIT" | "INTEREST";
  mode: LedgerMode;
  referenceNo: string | null;
  remarks: string | null;
  office: { name: string; city: string };
  depositedAt: string;
  createdBy: string;
};

export type DepositPage = { page: number; pageSize: number; total: number; items: DepositEntry[] };

export const money = (amount: string) =>
  `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
