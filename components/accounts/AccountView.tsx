"use client";

import { DetailSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon, type IconName } from "@/components/icons";
import {
  SEX_LABEL,
  ageFrom,
  formatAadhaar,
  formatAmount,
  formatDate,
  type AccountDetail,
  type DocumentKind,
} from "@/lib/accounts/types";
import { ApiError, errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { accountTypeLabel } from "@/lib/deposits/types";
import { formatDateTime, officeLabel } from "@/lib/auth/types";
import { AccountInstallments } from "./AccountInstallments";
import { AccountMonthlyInterest } from "./AccountMonthlyInterest";
import { AccountTransactions } from "./AccountTransactions";
import { AccountReferral } from "./AccountReferral";
import { AccountWithdrawalCycle } from "./AccountWithdrawalCycle";
import { DocumentViewer } from "./DocumentViewer";
import { KycDialog } from "@/components/kyc/KycDialog";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";

const DOC_LABEL: Record<DocumentKind, string> = {
  panCard: "PAN Card copy",
  aadhaarCard: "Aadhaar Card copy",
};

/** All Accounts → one account: every registration-form field, photo and documents. */
export function AccountView({ accountNo }: { accountNo: string }) {
  const { authFetch } = useAuth();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [viewing, setViewing] = useState<DocumentKind | null>(null);
  const [kycOpen, setKycOpen] = useState(false);
  const [version, setVersion] = useState(0); // bumped after a KYC change to reload the account

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AccountDetail>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}`, {
      signal: controller.signal,
    }).then(setAccount, (err) => {
      if ((err as Error).name !== "AbortError") setError(err);
    });
    return () => controller.abort();
  }, [authFetch, accountNo, version]);

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <Alert tone="error">
          {notFound ? "This account doesn't exist, or it belongs to another office." : errorMessage(error)}
        </Alert>
      </div>
    );
  }
  if (!account) return <div className="mx-auto max-w-6xl"><DetailSkeleton /></div>;

  const a = account;
  const age = ageFrom(a.dob);
  const kycVerified = a.kyc.status === "VERIFIED";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink />

      {!kycVerified && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
          a.kyc.status === "SUBMITTED" ? "border-blue-200 bg-blue-50" : a.kyc.status === "REJECTED" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-start gap-3">
            <Icon name="shieldCheck" className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-semibold text-navy">
                {a.kyc.status === "SUBMITTED" ? "KYC documents are waiting for approval" : a.kyc.status === "REJECTED" ? "KYC documents were rejected" : "KYC is pending"}
              </p>
              <p className="text-slate-700">
                {a.kyc.status === "REJECTED" && a.kyc.remarks ? `${a.kyc.remarks}. ` : ""}
                {!a.panNo && !a.aadhaarNo ? "PAN and Aadhaar have not been given. " : !a.kyc.panVerified && !a.panNo ? "PAN has not been given. " : !a.kyc.aadhaarVerified && !a.aadhaarNo ? "Aadhaar has not been given. " : ""}
                This account can deposit, but cannot withdraw until KYC is verified.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setKycOpen(true)}
            className="flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark">
            <Icon name="shieldCheck" className="size-4" /> {a.kyc.status === "SUBMITTED" ? "Review documents" : "Complete KYC"}
          </button>
        </div>
      )}

      {/* ------------------------------ Header ------------------------------ */}
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
        <img
          src={a.photo}
          alt={`Photograph of ${a.name}`}
          className="aspect-[35/45] w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-cover"
        />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold break-words text-navy sm:text-3xl">
            {a.name} <KycStatusBadge status={a.kyc.status} className="text-xs" />
          </h1>
          {a.fatherHusbandName && <p className="mt-0.5 text-sm text-slate-600">C/o {a.fatherHusbandName}</p>}
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <HeaderStat label="Account No." value={a.accountNo} mono />
            <HeaderStat label="Form No." value={a.formNo} mono />
            <HeaderStat label="Balance" value={formatAmount(a.balance)} />
            <HeaderStat label="Office" value={officeLabel(a.office)} />
          </dl>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:flex-col sm:self-center">
          <Link
            href={`/admin/deposits?accountNo=${a.accountNo}`}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            <Icon name="download" className="size-4" /> Deposit
          </Link>
          {kycVerified ? (
            <Link
              href={`/admin/withdrawals?accountNo=${a.accountNo}`}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
            >
              <Icon name="upload" className="size-4" /> Withdraw
            </Link>
          ) : (
            <span
              title="Withdrawals are blocked until KYC is verified"
              className="flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-200 px-5 text-sm font-medium text-slate-500"
            >
              <Icon name="lock" className="size-4" /> Withdraw
            </span>
          )}
          <Link
            href={`/forms/account-holder-registration/${a.accountNo}?download=1`}
            target="_blank"
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-white px-5 text-sm font-medium text-brand hover:bg-brand-soft"
          >
            <Icon name="fileText" className="size-4" /> Download Form
          </Link>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section icon="user" title="Personal Details">
          <Item label="Name" value={a.name} />
          <Item label="Last Name" value={a.lastName} />
          <Item label="Father's / Husband's Name" value={a.fatherHusbandName} />
          <Item label="Date of Birth" value={`${formatDate(a.dob)} (${age} yrs)`} />
          <Item label="Sex" value={SEX_LABEL[a.sex]} />
        </Section>

        <Section icon="house" title="Address">
          <Item label="Flat No. / Makan No." value={a.houseNo} />
          <Item label="Street / Locality / Area" value={a.address} wide />
          <Item label="City" value={a.city} />
          <Item label="State" value={a.state} />
          <Item label="PIN Code" value={a.pincode} mono />
        </Section>

        <Section icon="phone" title="Contact">
          <Item label="Mobile" value={`+91 ${a.mobileNumber}`} />
          <Item label="Alternate Mobile" value={a.alternateMobileNumber && `+91 ${a.alternateMobileNumber}`} />
          <Item label="E-mail" value={a.email} wide />
        </Section>

        <Section icon="idCard" title="KYC">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Status</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <KycStatusBadge status={a.kyc.status} />
              {a.kyc.verifiedAt && kycVerified && (
                <span className="text-xs text-slate-500">
                  {a.kyc.verifiedBy ? `by ${a.kyc.verifiedBy} · ` : ""}{formatDateTime(a.kyc.verifiedAt)}
                </span>
              )}
              {!kycVerified && (
                <button type="button" onClick={() => setKycOpen(true)} className="text-xs font-medium text-brand hover:underline">
                  {a.kyc.status === "SUBMITTED" ? "Review documents" : "Complete KYC"}
                </button>
              )}
            </dd>
          </div>
          <Item label={`PAN No.${a.panNo ? (a.kyc.panVerified ? " · verified" : " · to review") : ""}`} value={a.panNo ?? "Not given yet"} mono={!!a.panNo} />
          <Item label={`Aadhaar No.${a.aadhaarNo ? (a.kyc.aadhaarVerified ? " · verified" : " · to review") : ""}`} value={a.aadhaarNo ? formatAadhaar(a.aadhaarNo) : "Not given yet"} mono={!!a.aadhaarNo} />
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Documents</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {!a.documents.panCard.mime && !a.documents.aadhaarCard.mime && <span className="text-sm text-slate-400">No documents uploaded yet</span>}
              {(["panCard", "aadhaarCard"] as const).filter((kind) => a.documents[kind].mime).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setViewing(kind)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-brand/40 px-3 text-sm font-medium text-brand hover:bg-brand-soft"
                >
                  <Icon name={a.documents[kind].mime === "application/pdf" ? "fileText" : "eye"} className="size-4" />
                  View {DOC_LABEL[kind]}
                </button>
              ))}
            </dd>
          </div>
        </Section>

        <Section icon="wallet" title="Bank Details & Amount">
          <Item label="Bank Name" value={a.bankName} />
          <Item label="A/c No." value={a.bankAccountNo} mono />
          <Item label="IFSC Code" value={a.ifscCode} mono />
          <Item label="Branch" value={a.branch} />
          <Item label="Opening Amount" value={formatAmount(a.amount)} />
          <Item label="Current Balance" value={formatAmount(a.balance)} />
          <Item label="Total Deposited" value={`${formatAmount(a.totalDeposited)} (${a.depositCount})`} />
          <Item label="Total Withdrawn" value={`${formatAmount(a.totalWithdrawn)} (${a.withdrawalCount})`} />
          <Item label="Account Type" value={accountTypeLabel(a.terms.accountType)} />
          <Item label="Interest Rate" value={`${a.terms.interestRate}% per month`} />
          <Item label="Interest Credited" value={formatAmount(a.totalInterest)} />
        </Section>

        <Section icon="users" title="Nominee">
          <Item label="Nominee Name" value={a.nomineeName} />
          <Item label="Age" value={a.nomineeAge === null ? null : `${a.nomineeAge} yrs`} />
          <Item label="Relation" value={a.nomineeRelation} />
        </Section>

        <Section icon="handCoins" title="Sponsor's Detail">
          <Item label="Sponsor Name" value={a.sponsorName} />
          <Item label="Mobile" value={a.sponsorMobile && `+91 ${a.sponsorMobile}`} />
          <Item label="Sponsor ID" value={a.sponsorId} mono />
        </Section>

        <Section icon="clipboard" title="Record">
          <Item label="Opened By" value={a.createdBy} />
          <Item label="Opened On" value={formatDateTime(a.createdAt)} />
          <Item label="Office" value={`${officeLabel(a.office)} (${a.office.pincode})`} wide />
        </Section>
      </div>

      <AccountReferral accountNo={a.accountNo} />

      <AccountWithdrawalCycle accountNo={a.accountNo} />

      <AccountMonthlyInterest accountNo={a.accountNo} />

      <AccountInstallments accountNo={a.accountNo} totalInterest={a.totalInterest} />

      <AccountTransactions accountNo={a.accountNo} />

      {kycOpen && (
        <KycDialog
          account={{
            accountNo: a.accountNo,
            name: a.name,
            mobileNumber: a.mobileNumber,
            panNo: a.panNo,
            aadhaarNo: a.aadhaarNo,
            panKyc: a.kyc.panVerified,
            aadhaarKyc: a.kyc.aadhaarVerified,
            remarks: a.kyc.remarks,
            status: a.kyc.status,
          }}
          onClose={() => setKycOpen(false)}
          onDone={() => {
            setKycOpen(false);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {viewing && (
        <DocumentViewer
          accountNo={a.accountNo}
          kind={viewing}
          title={`${DOC_LABEL[viewing]} — ${a.name}`}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------ building blocks ------------------------------ */

function BackLink() {
  return (
    <Link href="/admin/accounts" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy">
      <Icon name="arrowRight" className="size-4 rotate-180" /> All Accounts
    </Link>
  );
}

function HeaderStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-semibold text-navy ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-navy">
        <Icon name={icon} className="size-5 text-brand" /> {title}
      </h2>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, value, mono, wide }: { label: string; value: string | null; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-sm break-words ${value ? "text-navy" : "text-slate-400"} ${mono && value ? "font-mono" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}
