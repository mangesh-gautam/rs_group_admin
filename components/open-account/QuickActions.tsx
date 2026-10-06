import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export type QuickAction = { label: string; href: string; icon: IconName };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
        <Icon name="zap" className="size-5 text-violet-500" />
        Quick Actions
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 transition hover:border-brand/40 hover:bg-brand-soft/50"
          >
            <Icon name={a.icon} className="size-5 text-brand" />
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
