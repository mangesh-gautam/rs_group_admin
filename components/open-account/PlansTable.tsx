import Link from "next/link";
import { Icon } from "@/components/icons";

export type Plan = {
  id: string;
  name: string;
  /** Percent, e.g. 0.75 */
  interestRate: number;
  lockInMonths: number;
  minDeposit: number;
  maxDeposit: number;
  features: string[];
};

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function PlansTable({ plans }: { plans: Plan[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Icon name="fileText" className="size-5 text-brand" />
          Account Plans &amp; Features
        </h2>
        <Link
          href="/admin/plans"
          className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          View All Plans <Icon name="arrowRight" className="size-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-medium">Plan Name</th>
              <th className="px-3 py-2 font-medium">Interest Rate</th>
              <th className="px-3 py-2 font-medium">Min. Deposit</th>
              <th className="px-3 py-2 font-medium">Max. Deposit</th>
              <th className="px-3 py-2 font-medium">Features</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-3 font-medium text-navy">{p.name}</td>
                <td className="px-3 py-3">
                  {p.interestRate.toFixed(2)}%{" "}
                  <span className="text-[10px] text-slate-500">
                    (after {p.lockInMonths} months)
                  </span>
                </td>
                <td className="px-3 py-3">{formatINR(p.minDeposit)}</td>
                <td className="px-3 py-3">{formatINR(p.maxDeposit)}</td>
                <td className="px-3 py-3">
                  <ul className="list-inside list-disc space-y-0.5 text-[11px] marker:text-brand">
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
