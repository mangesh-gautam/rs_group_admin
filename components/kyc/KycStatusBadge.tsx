import { KYC_LABEL, type KycStatus } from "@/lib/accounts/types";

const TONE: Record<KycStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  SUBMITTED: "border-blue-200 bg-blue-50 text-brand",
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

/** Small pill with the account's KYC status. */
export function KycStatusBadge({ status, className = "" }: { status: KycStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE[status]} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {KYC_LABEL[status]}
    </span>
  );
}

/** "Verified" / "Uploaded" / "Missing" for one document. */
/** One document's state: verified, number + copy waiting for review, or what is still missing. */
export function KycDocState({ number, copy, verified }: { number: string | null; copy: boolean; verified: boolean }) {
  if (verified) return <span className="text-xs font-medium text-emerald-700">✓ Verified</span>;
  if (number && copy) return <span className="text-xs font-medium text-brand">Uploaded · to review</span>;
  if (number) return <span className="text-xs font-medium text-amber-700">Number only · copy missing</span>;
  if (copy) return <span className="text-xs font-medium text-amber-700">Copy only · number missing</span>;
  return <span className="text-xs text-slate-400">Missing</span>;
}
