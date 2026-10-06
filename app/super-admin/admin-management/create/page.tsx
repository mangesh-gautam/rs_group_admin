import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { CreateAdminForm } from "@/components/super-admin/CreateAdminForm";
import { HowItWorks, type HowItWorksStep } from "@/components/super-admin/HowItWorks";

// ============================================================================
// Static copy for the side panel.
// ============================================================================

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: "Create the Admin",
    body: "Enter the admin's details, their registered mobile number and a temporary password.",
  },
  {
    title: "Password + OTP sign-in",
    body: "The admin signs in with username and password, then verifies the OTP sent to the registered mobile.",
  },
  {
    title: "Mandatory password change",
    body: "On first sign-in the admin must replace the temporary password before reaching the dashboard.",
  },
];

const SECURITY_NOTE = {
  title: "Security Note",
  body: "Share the temporary password privately. It is stored only as a secure hash, and it stops working as soon as the admin sets their own password.",
};
// ============================================================================

export const metadata: Metadata = {
  title: "Create Admin",
};

export default function CreateAdminPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start gap-6 sm:mb-8">
        <span className="hidden size-20 shrink-0 place-items-center rounded-full bg-brand-soft sm:grid">
          <Icon name="shieldCheck" className="size-10 text-brand" strokeWidth={2} />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">
            Super Admin · Admin Management
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">Create Admin</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            Create a secure admin account. The admin signs in with a password and a one-time code
            sent to their registered mobile number.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <CreateAdminForm />
        <HowItWorks steps={HOW_IT_WORKS} securityNote={SECURITY_NOTE} tagline="Secure Access. Better Control." />
      </div>
    </div>
  );
}
