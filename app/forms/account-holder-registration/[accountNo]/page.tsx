import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { FilledRegistrationForm } from "@/components/forms/FilledRegistrationForm";

export const metadata: Metadata = {
  title: "Account Holder Registration Form",
};

/**
 * The registration form of one account, filled in, ready to print / save as PDF.
 * ?download=1 opens the print dialog; ?opened=1 = shown right after opening the account.
 */
export default async function FilledRegistrationFormPage({
  params,
  searchParams,
}: PageProps<"/forms/account-holder-registration/[accountNo]">) {
  const { accountNo } = await params;
  const { download, opened } = await searchParams;
  return (
    <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
      <FilledRegistrationForm accountNo={accountNo} autoDownload={download === "1"} justOpened={opened === "1"} />
    </RequireAuth>
  );
}
