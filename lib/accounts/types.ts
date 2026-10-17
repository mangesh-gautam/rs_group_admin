import type { OfficeRef } from "@/lib/auth/types";
import type { AccountTerms, LedgerMode } from "@/lib/deposits/types";

/**
 * KYC of an account. PENDING: PAN and / or Aadhaar missing · SUBMITTED:
 * uploaded, waiting for an admin · VERIFIED · REJECTED (see remarks).
 * Only VERIFIED accounts can withdraw; every account can deposit.
 */
export type KycStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export const KYC_LABEL: Record<KycStatus, string> = {
  PENDING: "KYC pending",
  SUBMITTED: "Awaiting approval",
  VERIFIED: "KYC verified",
  REJECTED: "KYC rejected",
};

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
  kycStatus: KycStatus;
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
  lastName: string | null;
  panNo: string | null; // null until uploaded (KYC pending)
  aadhaarNo: string | null;
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
  documents: Record<DocumentKind, { mime: string | null }>; // null mime = not uploaded
  kyc: {
    status: KycStatus;
    panVerified: boolean;
    aadhaarVerified: boolean;
    submittedAt: string | null;
    submittedVia: "ADMIN" | "CUSTOMER" | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    remarks: string | null; // reason of the last rejection
  };
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

/** Row of GET /api/customers/kyc — accounts that are not KYC-verified. */
export type KycAccount = {
  accountNo: string;
  name: string;
  mobileNumber: string;
  panNo: string | null;
  aadhaarNo: string | null;
  panKyc: boolean; // PAN verified
  aadhaarKyc: boolean; // Aadhaar verified
  status: Exclude<KycStatus, "VERIFIED">;
  submittedAt: string | null;
  submittedVia: "ADMIN" | "CUSTOMER" | null;
  remarks: string | null;
  balance: string;
  office: Omit<OfficeRef, "pincode">;
  createdAt: string;
};

export type KycPage = {
  page: number;
  pageSize: number;
  total: number;
  items: KycAccount[];
  counts: { pending: number; submitted: number; rejected: number } | null;
};

/** What the KYC dialog needs about an account (from the account page or the KYC list). */
export type KycTarget = Pick<KycAccount, "accountNo" | "name" | "mobileNumber" | "panNo" | "aadhaarNo" | "panKyc" | "aadhaarKyc" | "remarks"> & {
  status: KycStatus;
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
  operator?: { id: number | null; name: string; username: string | null; role: string };
  office?: { id: number; name: string; city: string };
  /** Super Admin only: may this entry still be corrected (window, closed month, kind)? */
  correction?: { editable: boolean; deletable: boolean; until: string; reason: string | null } | null;
};

/** Row of GET /api/admin/transaction-corrections — a Super Admin edit or delete. */
export type TransactionCorrectionEntry = {
  id: number;
  action: "EDIT" | "DELETE";
  type: StatementType;
  receiptNo: string;
  accountNo: string;
  name: string;
  amountBefore: string;
  amountAfter: string | null;
  before: { mode: string | null; referenceNo: string | null; remarks: string | null; at: string | null };
  after: { mode: string | null; referenceNo: string | null; remarks: string | null } | null;
  commissionRemoved: number;
  balanceBefore: string;
  balanceAfter: string;
  reason: string;
  at: string;
  by: string;
};

export type StatementPage = { page: number; pageSize: number; total: number; items: StatementEntry[]; summary?: { balance: string; totalDeposited: string; totalWithdrawn: string; entryCount: number; lastAt: string | null } };

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
export const formatAadhaar = (v: string | null) => (v ? v.replace(/(\d{4})(?=\d)/g, "$1 ") : "");

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
