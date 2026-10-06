"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PrintButton } from "@/app/forms/account-holder-registration/PrintButton";
import { Alert } from "@/components/auth/FormControls";
import { SEX_LABEL, formatAadhaar, formatAmount, type AccountDetail } from "@/lib/accounts/types";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRINT_CSS, RegistrationFormSheet, type RegistrationFormData } from "./RegistrationFormSheet";

const ddmmyyyy = (d: Date) => d.toLocaleDateString("en-GB"); // 14/03/1988

const toFormData = (a: AccountDetail): RegistrationFormData => ({
  formNo: a.formNo,
  registrationNo: a.accountNo,
  name: a.name,
  fatherHusbandName: a.fatherHusbandName,
  houseNo: a.houseNo,
  address: a.address,
  city: a.city,
  state: a.state,
  pincode: a.pincode,
  dob: ddmmyyyy(new Date(`${a.dob}T00:00:00`)),
  sex: SEX_LABEL[a.sex],
  mobile: a.mobileNumber,
  alternateMobile: a.alternateMobileNumber,
  panNo: a.panNo,
  aadhaarNo: formatAadhaar(a.aadhaarNo),
  bankName: a.bankName,
  bankAccountNo: a.bankAccountNo,
  ifscCode: a.ifscCode,
  branch: a.branch,
  amount: formatAmount(a.amount),
  email: a.email,
  nomineeName: a.nomineeName,
  nomineeAge: a.nomineeAge === null ? null : String(a.nomineeAge),
  nomineeRelation: a.nomineeRelation,
  date: ddmmyyyy(new Date(a.createdAt)),
  sponsorName: a.sponsorName,
  sponsorMobile: a.sponsorMobile,
  sponsorId: a.sponsorId,
  photo: a.photo,
});

/**
 * An account's Account Holder Registration Form, filled in from the saved
 * registration (GET /api/customers/account-holders/:accountNo). "Download"
 * opens the print dialog; the page title becomes the suggested PDF file name.
 */
export function FilledRegistrationForm({
  accountNo,
  autoDownload,
  justOpened,
}: {
  accountNo: string;
  autoDownload?: boolean;
  /** Shown right after Open New Account saved this account. */
  justOpened?: boolean;
}) {
  const { authFetch } = useAuth();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AccountDetail>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}`, {
      signal: controller.signal,
    }).then(setAccount, (err) => {
      if ((err as Error).name !== "AbortError") setError(err);
    });
    return () => controller.abort();
  }, [authFetch, accountNo]);

  // Suggested file name for "Save as PDF", e.g. "Registration Form RS110033000001 - Rahul Sharma"
  useEffect(() => {
    if (!account) return;
    const previous = document.title;
    document.title = `Registration Form ${account.accountNo} - ${account.name}`;
    return () => {
      document.title = previous;
    };
  }, [account]);

  // ?download=1: open the dialog once the sheet (and its photo) has rendered
  useEffect(() => {
    if (!account || !autoDownload) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [account, autoDownload]);

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      {justOpened && account && (
        <div className="mx-auto mb-4 w-[210mm] max-w-full px-4 print:hidden">
          <Alert tone="success">
            Account opened for <b>{account.name}</b> — Account No. <b className="font-mono">{account.accountNo}</b>{" "}
            (Form No. <b className="font-mono">{account.formNo}</b>). Print the form or save it as PDF for the
            member&apos;s signature.
          </Alert>
        </div>
      )}

      <div className="mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href={`/admin/accounts/${accountNo}`} className="text-slate-700 hover:text-navy">
            ← {justOpened ? "View account" : "Back to account"}
          </Link>
          {justOpened && (
            <Link href="/admin/open-account" className="text-slate-700 hover:text-navy">
              + Open another account
            </Link>
          )}
        </div>
        <PrintButton label="Download Form (PDF)" disabled={!account} />
      </div>

      {error ? (
        <div className="mx-auto w-[210mm] max-w-full px-4">
          <Alert tone="error">
            {notFound ? "This account doesn't exist, or it belongs to another office." : errorMessage(error)}
          </Alert>
        </div>
      ) : !account ? (
        <div className="mx-auto h-[297mm] w-[210mm] max-w-full animate-pulse bg-white/70" />
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <RegistrationFormSheet data={toFormData(account)} />
        </div>
      )}
    </div>
  );
}
