import type { OfficeRef } from "@/lib/auth/types";
import type { AccountTerms, LedgerMode } from "@/lib/deposits/types";

/** Row of GET /api/customers/account-holders. */
export type AccountSummary = {
  id: number;
  accountNo: string;
  formNo: string;
  name: string;
  fatherHusbandName: string | null;
  mobileNumber: string;
  city: string;
  state: string;
  amount: string; // opening amount, decimal string, e.g. "5000.00"
  balance: string; // current balance (accounts.account_balances)
  office: Omit<OfficeRef, "pincode">;
  createdBy: string;
  createdAt: string;
};

export type AccountPage = { page: number; pageSize: number; total: number; items: AccountSummary[] };

export type DocumentKind = "panCard" | "aadhaarCard";

/** GET /api/customers/account-holders/:accountNo */
export type AccountDetail = Omit<AccountSummary, "office"> & {
  houseNo: string;
  address: string;
  pincode: string;
  dob: string; // YYYY-MM-DD
  alternateMobileNumber: string | null;
  sex: "MALE" | "FEMALE" | "OTHER";
  panNo: string;
  aadhaarNo: string;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  branch: string | null;
  email: string | null;
  nomineeName: string | null;
  nomineeAge: number | null;
  nomineeRelation: string | null;
  sponsorName: string | null;
  sponsorMobile: string | null;
  sponsorId: string | null;
  office: OfficeRef;
  photo: string; // data URL
  documents: Record<DocumentKind, { mime: string }>;
  depositCount: number;
  lastDepositAt: string | null;
  totalDeposited: string;
  totalWithdrawn: string;
  withdrawalCount: number;
  lastWithdrawalAt: string | null;
  totalInterest: string;
  terms: AccountTerms;
  createdById: number;
};

export type StatementType = "DEPOSIT" | "WITHDRAWAL";

/** Row of GET /api/customers/account-holders/:accountNo/transactions */
export type StatementEntry = {
  type: StatementType;
  receiptNo: string; // DEP… or WDL…
  kind: "OPENING" | "DEPOSIT" | "INTEREST" | "WITHDRAWAL";
  mode: LedgerMode;
  referenceNo: string | null;
  remarks: string | null;
  credit: string;
  debit: string;
  balanceAfter: string; // derived at read time over the whole ledger
  at: string;
  createdBy: string;
};

export type StatementPage = { page: number; pageSize: number; total: number; items: StatementEntry[] };

/** Row of GET /api/customers/account-holders/:accountNo/installments (newest first). */
export type Installment = {
  installmentNo: number;
  dueOn: string; // YYYY-MM-DD
  bufferEndsOn: string; // last day to pay without a fine
  paidOn: string | null; // first deposit counted for this installment
  amountPaid: string;
  fineApplicable: boolean;
};

export type InstallmentSchedule = AccountTerms & {
  accountNo: string;
  finesApplicable: number;
  items: Installment[];
};

export const formatAmount = (amount: string) =>
  `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** "2345 6789 0123" */
export const formatAadhaar = (v: string) => v.replace(/(\d{4})(?=\d)/g, "$1 ");

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const ageFrom = (dob: string) => {
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
};

export const SEX_LABEL: Record<AccountDetail["sex"], string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
