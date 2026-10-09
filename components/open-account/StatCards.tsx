import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export type Stat = {
  label: string;
  value: string;
  icon: IconName;
  tone: "green" | "blue" | "orange" | "purple";
  trend?: string;
  link?: { label: string; href: string };
};

const TONES: Record<
  Stat["tone"],
  { card: string; badge: string; label: string; value: string; accent: string }
> = {
  green: {
    card: "from-emerald-50/80 border-emerald-100",
    badge: "bg-emerald-500",
    label: "text-slate-700",
    value: "text-navy",
    accent: "text-emerald-600",
  },
  blue: {
    card: "from-blue-50 border-blue-100",
    badge: "bg-blue-500/80",
    label: "text-brand",
    value: "text-navy",
    accent: "text-brand",
  },
  orange: {
    card: "from-amber-50 border-amber-100",
    badge: "bg-orange-400",
    label: "text-orange-500",
    value: "text-orange-500",
    accent: "text-orange-500",
  },
  purple: {
    card: "from-violet-50 border-violet-100",
    badge: "bg-violet-500/80",
    label: "text-violet-700",
    value: "text-navy",
    accent: "text-violet-600",
  },
};

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${stats.length === 6 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
      {stats.map((s) => {
        const t = TONES[s.tone];
        return (
          <div
            key={s.label}
            className={`rounded-xl border bg-gradient-to-b to-white p-3.5 ${t.card}`}
          >
            <span
              className={`grid size-8 place-items-center rounded-full text-white ${t.badge}`}
            >
              <Icon name={s.icon} className="size-4" />
            </span>
            <p className={`mt-3 text-xs font-medium ${t.label}`}>{s.label}</p>
            <p
              className={`mt-0.5 break-words text-base font-bold 2xl:text-xl ${t.value}`}
            >
              {s.value}
            </p>
            {s.trend && (
              <p
                className={`mt-2 flex items-center gap-1 text-[11px] ${t.accent}`}
              >
                <Icon name="arrowUp" className="size-3" />
                {s.trend}
              </p>
            )}
            {s.link && (
              <Link
                href={s.link.href}
                className={`mt-2 flex items-center gap-1 text-[11px] hover:underline ${t.accent}`}
              >
                {s.link.label}
                <Icon name="arrowRight" className="size-3" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
