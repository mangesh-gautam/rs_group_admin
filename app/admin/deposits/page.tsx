import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { DepositsScreen } from "@/components/deposits/DepositsScreen";

export const metadata: Metadata = {
  title: "Deposits",
};

/** /admin/deposits?accountNo=RS110033000001 pre-fills the account (e.g. from the account page). */
export default async function DepositsPage({ searchParams }: PageProps<"/admin/deposits">) {
  const { accountNo } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft">
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
            <Icon name="download" className="size-6" />
          </span>
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Deposits</h1>
          <p className="text-sm text-slate-600">Deposit an amount into a member account and review deposits.</p>
        </div>
      </div>
      <DepositsScreen initialAccountNo={typeof accountNo === "string" ? accountNo : ""} />
    </div>
  );
}
