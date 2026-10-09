import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { OpenAccountForm } from "@/components/open-account/OpenAccountForm";
import { DashboardOverview } from "@/components/admin/DashboardOverview";

export const metadata: Metadata = {
  title: "Open New Account",
};

export default function OpenAccountPage() {
  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft">
            <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
              <Icon name="plus" className="size-6" strokeWidth={2.5} />
            </span>
          </span>
          <div>
            <h1 className="text-2xl font-bold text-navy">Open New Account</h1>
            <p className="text-sm text-slate-600">
              Fill in the Account Holder Registration Form to open a member account.
            </p>
            <Link
              href="/forms/account-holder-registration"
              target="_blank"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <Icon name="fileText" className="size-4" />
              Print blank registration form (A4)
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <OpenAccountForm />

        <DashboardOverview />
      </div>
    </div>
  );
}
