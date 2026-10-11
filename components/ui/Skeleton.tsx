import type { ReactNode } from "react";

/** Decorative placeholder. Use SkeletonRegion once around a loading section. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonRegion({ children, label = "Loading content…", className = "space-y-4" }: {
  children: ReactNode; label?: string; className?: string;
}) {
  return <div role="status" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-4">{children}</div>
  </div>;
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: count }, (_, i) => <div key={i} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="size-10" /></div>
      <Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-24" />
    </div>)}
  </div>;
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4"><Skeleton className="h-10 w-full sm:w-64" /><Skeleton className="h-10 w-32" /></div>
    <div className="divide-y divide-slate-100 md:hidden">{Array.from({ length: rows }, (_, i) => <div key={i} className="space-y-3 p-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}</div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead><tr>{Array.from({ length: columns }, (_, i) => <th key={i} className="bg-slate-50 p-4"><Skeleton className="h-3 w-full" /></th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, i) => <tr key={i} className="border-t border-slate-100">{Array.from({ length: columns }, (_, j) => <td key={j} className="p-4"><Skeleton className={j === 0 ? "h-5 w-3/4" : "h-4 w-full"} /></td>)}</tr>)}</tbody>
    </table></div>
    <div className="flex justify-between border-t border-slate-100 p-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-24" /></div>
  </div>;
}

export function FormSkeleton({ fields = 8 }: { fields?: number }) {
  return <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <Skeleton className="h-6 w-48" />
    <div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: fields }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-11 w-full" /></div>)}</div>
    <div className="flex justify-end"><Skeleton className="h-11 w-36" /></div>
  </div>;
}

export function DashboardSkeleton({ calculator = false }: { calculator?: boolean }) {
  return <SkeletonRegion label="Loading dashboard…"><CardsSkeleton />
    {calculator && <FormSkeleton fields={4} />}
    <CardsSkeleton count={3} /><TableSkeleton rows={5} columns={5} />
  </SkeletonRegion>;
}

export function DetailSkeleton() {
  return <SkeletonRegion label="Loading details…"><Skeleton className="h-5 w-40" />
    <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6"><Skeleton className="size-20 shrink-0 rounded-full" /><div className="w-full space-y-3"><Skeleton className="h-7 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></div>
    <CardsSkeleton count={3} /><FormSkeleton fields={6} /><TableSkeleton />
  </SkeletonRegion>;
}

export function DocumentSkeleton() {
  return <SkeletonRegion label="Loading document…" className="mx-auto w-full max-w-2xl">
    <div className="min-h-[50vh] space-y-6 rounded-xl bg-white p-8"><Skeleton className="mx-auto h-8 w-1/2" /><Skeleton className="h-32 w-full" /><FormSkeleton fields={6} /></div>
  </SkeletonRegion>;
}

export type ScreenSkeletonKind = "dashboard" | "list" | "detail" | "form" | "transaction" | "auth" | "document";
export function ScreenSkeleton({ kind = "dashboard" }: { kind?: ScreenSkeletonKind }) {
  if (kind === "auth") return <div className="grid min-h-screen place-items-center bg-background p-4"><SkeletonRegion label="Loading sign-in…" className="w-full max-w-md"><Skeleton className="mx-auto h-12 w-40" /><FormSkeleton fields={3} /></SkeletonRegion></div>;
  if (kind === "document") return <DocumentSkeleton />;
  if (kind === "detail") return <DetailSkeleton />;
  return <SkeletonRegion label="Loading screen…"><div className="flex justify-between gap-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-10 w-28" /></div>
    {kind === "dashboard" ? <DashboardSkeleton calculator /> : kind === "list" ? <TableSkeleton /> : kind === "transaction" ? <><CardsSkeleton count={3} /><FormSkeleton fields={4} /><TableSkeleton /></> : <FormSkeleton />}
  </SkeletonRegion>;
}
