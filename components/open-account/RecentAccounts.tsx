import Link from "next/link";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/lib/auth/types";
import type { Dashboard } from "@/lib/dashboard/types";

export type RecentAccount = Dashboard["recentAccounts"][number];

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
              <th className="px-2 py-2 font-medium">Balance</th>
              <th className="px-2 py-2 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {accounts.map((a) => (
              <tr key={a.accountNo}>
                <td className="px-2 py-2.5"><Link href={`/admin/accounts/${a.accountNo}`} className="font-medium text-brand hover:underline">{a.accountNo}</Link></td>
                <td className="px-2 py-2.5">{a.name}</td>
                <td className="px-2 py-2.5">{a.accountType.charAt(0) + a.accountType.slice(1).toLowerCase()}</td>
                <td className="px-2 py-2.5">
                  ₹ {Number(a.balance).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2.5">{formatDateTime(a.createdAt)}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">No accounts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
