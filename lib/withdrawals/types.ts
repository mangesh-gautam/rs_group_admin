/** Types for the withdrawal-service API (/api/withdrawals). Amounts are decimal strings. */
import type { DepositMode } from "@/lib/deposits/types";

export type PaymentMode = DepositMode; // same modes for paying out: CASH | UPI | CHEQUE | BANK_TRANSFER

/** GET /api/withdrawals/accounts/:accountNo */
export type WithdrawalAccount = {
  accountNo: string;
  name: string;
  fatherHusbandName: string | null;
  mobileNumber: string;
  city: string;
  office: { name: string; city: string };
  photo: string; // data URL
  balance: string; // available to withdraw
  totalDeposited: string;
  totalWithdrawn: string;
  withdrawalCount: number;
  lastWithdrawalAt: string | null;
};

/** POST /api/withdrawals → 201 */
export type WithdrawalReceipt = {
  receiptNo: string; // WDL00000001 …
  accountNo: string;
  name: string;
  amount: string;
  mode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  balance: string; // balance after this withdrawal
  withdrawnAt: string;
  createdBy: string;
};

/** Row of GET /api/withdrawals */
export type WithdrawalEntry = {
  receiptNo: string;
  accountNo: string;
  name: string;
  amount: string;
  balanceAfter: string;
  mode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  office: { name: string; city: string };
  withdrawnAt: string;
  createdBy: string;
};

export type WithdrawalPage = { page: number; pageSize: number; total: number; items: WithdrawalEntry[] };
