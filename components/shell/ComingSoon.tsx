import Link from "next/link";
import { Icon } from "@/components/icons";

/** Placeholder for routes that are in the nav but not built yet. */
export function ComingSoon({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="settings" className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          This screen hasn&apos;t been built yet.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Go back
        </Link>
      </div>
    </div>
  );
}

export const titleFromSlug = (slug: string[]) =>
  slug
    .at(-1)!
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
