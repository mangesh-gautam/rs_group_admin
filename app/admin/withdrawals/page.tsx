import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { WithdrawalsScreen } from "@/components/withdrawals/WithdrawalsScreen";

export const metadata: Metadata = {
  title: "Withdrawals",
};

/** /admin/withdrawals?accountNo=RS110033000001 pre-fills the account (e.g. from the account page). */
export default async function WithdrawalsPage({ searchParams }: PageProps<"/admin/withdrawals">) {
  const { accountNo } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-amber-50">
          <span className="grid size-10 place-items-center rounded-full bg-amber-600 text-white shadow-md shadow-amber-600/30">
            <Icon name="upload" className="size-6" />
          </span>
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Withdrawals</h1>
          <p className="text-sm text-slate-600">Withdraw an amount from a member account and review withdrawals.</p>
        </div>
      </div>
      <WithdrawalsScreen initialAccountNo={typeof accountNo === "string" ? accountNo : ""} />
    </div>
  );
}
