import Link from "next/link";
import { Icon } from "@/components/icons";

export type RecentAccount = {
  accountNo: string;
  name: string;
  type: string;
  deposit: number;
  status: "Active" | "Pending" | "Closed";
  date: string;
};

const STATUS_STYLES: Record<RecentAccount["status"], string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function RecentAccounts({ accounts }: { accounts: RecentAccount[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Icon name="fileText" className="size-5 text-brand" />
          Recent Accounts
        </h2>
        <Link
          href="/admin/accounts"
          className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          View All <Icon name="arrowRight" className="size-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[11px]">
          <thead className="text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Account No.</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Deposit Amount</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {accounts.map((a) => (
              <tr key={a.accountNo}>
                <td className="px-2 py-2.5">{a.accountNo}</td>
                <td className="px-2 py-2.5">{a.name}</td>
                <td className="px-2 py-2.5">{a.type}</td>
                <td className="px-2 py-2.5">
                  ₹ {a.deposit.toLocaleString("en-IN")}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${STATUS_STYLES[a.status]}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-2 py-2.5">{a.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
