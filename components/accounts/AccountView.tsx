"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Spinner } from "@/components/auth/FormControls";
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
import { AccountWithdrawalCycle } from "./AccountWithdrawalCycle";

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

  useEffect(() => {
    const controller = new AbortController();
    authFetch<AccountDetail>(`/api/customers/account-holders/${encodeURIComponent(accountNo)}`, {
      signal: controller.signal,
    }).then(setAccount, (err) => {
      if ((err as Error).name !== "AbortError") setError(err);
    });
    return () => controller.abort();
  }, [authFetch, accountNo]);

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
  if (!account) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const a = account;
  const age = ageFrom(a.dob);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink />

      {/* ------------------------------ Header ------------------------------ */}
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
        <img
          src={a.photo}
          alt={`Photograph of ${a.name}`}
          className="aspect-[35/45] w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-cover"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold break-words text-navy sm:text-3xl">{a.name}</h1>
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
          <Link
            href={`/admin/withdrawals?accountNo=${a.accountNo}`}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
          >
            <Icon name="upload" className="size-4" /> Withdraw
          </Link>
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
          <Item label="PAN No." value={a.panNo} mono />
          <Item label="Aadhaar No." value={formatAadhaar(a.aadhaarNo)} mono />
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Documents</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {(["panCard", "aadhaarCard"] as const).map((kind) => (
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

      <AccountWithdrawalCycle accountNo={a.accountNo} />

      <AccountMonthlyInterest accountNo={a.accountNo} />

      <AccountInstallments accountNo={a.accountNo} totalInterest={a.totalInterest} />

      <AccountTransactions accountNo={a.accountNo} />

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

/**
 * Loads a PAN / Aadhaar copy on demand (each view is audit-logged by the API)
 * and shows it in a dialog. Data URLs are turned into blob URLs so PDFs can
 * be displayed in an iframe.
 */
function DocumentViewer({
  accountNo,
  kind,
  title,
  onClose,
}: {
  accountNo: string;
  kind: DocumentKind;
  title: string;
  onClose: () => void;
}) {
  const { authFetch } = useAuth();
  const [doc, setDoc] = useState<{ url: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    authFetch<{ mime: string; dataUrl: string }>(
      `/api/customers/account-holders/${encodeURIComponent(accountNo)}/documents/${kind}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const blob = await (await fetch(res.dataUrl)).blob();
        url = URL.createObjectURL(blob);
        setDoc({ url, mime: res.mime });
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [authFetch, accountNo, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="truncate font-semibold text-navy">{title}</h2>
          <div className="flex items-center gap-2">
            {doc && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50"
              >
                <Icon name="download" className="size-3.5" /> Open in new tab
              </a>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <Icon name="x" className="size-5" />
            </button>
          </div>
        </div>
        <div className="grid min-h-[50vh] flex-1 place-items-center overflow-auto bg-slate-100 p-4">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : !doc ? (
            <Spinner />
          ) : doc.mime === "application/pdf" ? (
            <iframe src={doc.url} title={title} className="h-[75vh] w-full rounded bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL of the uploaded copy
            <img src={doc.url} alt={title} className="max-h-[75vh] max-w-full rounded object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
