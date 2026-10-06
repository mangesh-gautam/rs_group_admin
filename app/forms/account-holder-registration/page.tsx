import type { Metadata } from "next";
import Link from "next/link";
import { PRINT_CSS, RegistrationFormSheet } from "@/components/forms/RegistrationFormSheet";
import { PrintButton } from "./PrintButton";

/**
 * Blank, printable A4 "Account Holder Registration Form" for handwritten
 * completion. Black / white / grayscale only; every field is left empty.
 * The filled form of an account is at ./[accountNo].
 */

export const metadata: Metadata = {
  title: "Account Holder Registration Form",
};

export default function AccountHolderRegistrationFormPage() {
  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between gap-3 px-4 print:hidden">
        <Link href="/admin/open-account" className="text-sm text-slate-700 hover:text-navy">
          ← Back to Open New Account
        </Link>
        <PrintButton />
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <RegistrationFormSheet />
      </div>
    </div>
  );
}
