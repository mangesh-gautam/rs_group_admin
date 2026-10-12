"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import type { KycStatus } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { money } from "@/lib/deposits/types";
import type { ReferralSummary } from "@/lib/referral/types";

/** GET /api/customers/referral-tree */
export type TreeNode = {
  id: number;
  parentId: number | null;
  depth: number;
  accountNo: string;
  name: string;
  kycStatus: KycStatus;
  openedAt: string;
  office: { name: string; city: string };
  visible: boolean; // the viewer may open this account (own office / Super Admin)
  balance: string | null;
  commissionEarned: string | null;
  directCount: number;
};

const COMMISSION_DEPTH = 5;

/**
 * Referral Tree: the sponsor network, from one member down (?root=RS…) or the
 * whole network. Each row is a member under the member who sponsored them.
 * Levels 1–5 below the top member are highlighted: their deposits pay that
 * member commission; deeper levels don't.
 */
export function ReferralTree({ root, basePath }: { root: string | null; basePath: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [nodes, setNodes] = useState<TreeNode[] | null>(null);
  const [upline, setUpline] = useState<ReferralSummary["upline"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const qs = root ? `?root=${encodeURIComponent(root)}` : "";
    authFetch<{ nodes: TreeNode[] }>(`/api/customers/referral-tree${qs}`, { signal: controller.signal }).then(
      (r) => { setNodes(r.nodes); setError(null); setToggled({}); setExpandAll(null); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    if (root) {
      authFetch<ReferralSummary>(`/api/customers/account-holders/${encodeURIComponent(root)}/referral`, { signal: controller.signal })
        .then((s) => setUpline(s.upline), () => setUpline([]));
    }
    return () => controller.abort();
  }, [authFetch, root]);

  const tree = useMemo(() => buildTree(nodes ?? []), [nodes]);

  // search: matching members and every member on the way to them
  const q = query.trim().toLowerCase();
  const { matches, onPath } = useMemo(() => {
    const matches = new Set<number>();
    const onPath = new Set<number>();
    if (!q) return { matches, onPath };
    for (const n of nodes ?? []) {
      if (n.name.toLowerCase().includes(q) || n.accountNo.toLowerCase().includes(q)) {
        matches.add(n.id);
        for (let p = n.parentId; p !== null && tree.byId.has(p); p = tree.byId.get(p)!.parentId) onPath.add(p);
      }
    }
    return { matches, onPath };
  }, [q, nodes, tree]);

  const total = nodes?.length ?? 0;
  const defaultOpen = (n: TreeNode) => total <= 60 || n.depth < 2;
  const isOpen = (n: TreeNode) =>
    onPath.has(n.id) || (toggled[n.id] ?? (expandAll === null ? defaultOpen(n) : expandAll));
  const maxDepth = (nodes ?? []).reduce((m, n) => Math.max(m, n.depth), 0);
  const earned = (nodes ?? []).reduce((s, n) => s + Number(n.commissionEarned ?? 0), 0);
  const go = (accountNo: string | null) => router.push(accountNo ? `${basePath}?root=${accountNo}` : basePath);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
            <Icon name="users" className="size-6 text-brand" /> Referral Tree
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Every member sits under the member who sponsored them. Deposits of the first {COMMISSION_DEPTH} levels below a
            member pay that member commission.
          </p>
        </div>
        {root && (
          <button type="button" onClick={() => go(null)} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy hover:bg-slate-50">
            <Icon name="users" className="size-4" /> Whole network
          </button>
        )}
      </div>

      {/* breadcrumb: the root's upline */}
      {root && nodes && nodes.length > 0 && (
        <nav aria-label="Upline" className="flex flex-wrap items-center gap-1.5 text-sm">
          <button type="button" onClick={() => go(null)} className="text-brand hover:underline">Network</button>
          {[...upline].reverse().map((u) => (
            <span key={u.accountNo} className="flex items-center gap-1.5">
              <Icon name="chevronRight" className="size-3.5 text-slate-400" />
              <button type="button" onClick={() => go(u.accountNo)} className="text-brand hover:underline">{u.name}</button>
            </span>
          ))}
          <Icon name="chevronRight" className="size-3.5 text-slate-400" />
          <span className="font-semibold text-navy">{tree.roots[0]?.name}</span>
        </nav>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {nodes && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Members" value={String(total)} />
            <Stat label={root ? "Levels below" : "Deepest level"} value={String(maxDepth)} />
            <Stat label={root ? "Direct referrals" : "Top members"} value={String(root ? (tree.roots[0]?.directCount ?? 0) : tree.roots.length)} />
            <Stat label="Commission earned (shown)" value={money(String(earned))} />
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative w-full sm:w-80">
              <span className="sr-only">Find a member</span>
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a member (name or account no.)"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </label>
            <div className="flex items-center gap-2 text-xs">
              {q && <span className="text-slate-500">{matches.size} found</span>}
              <button type="button" onClick={() => { setExpandAll(true); setToggled({}); }} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-navy hover:bg-slate-50">Expand all</button>
              <button type="button" onClick={() => { setExpandAll(false); setToggled({}); }} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-navy hover:bg-slate-50">Collapse all</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">L1–L5</span> deposits pay the top member commission</span>
            <span className="flex items-center gap-1.5"><span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">L6+</span> too deep — no commission to the top member</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-5">
            {total === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No members in this network yet.</p>
            ) : (
              <ul className="@container/tree space-y-1">
                {tree.roots.map((n) => (
                  <Branch key={n.id} node={n} tree={tree} isOpen={isOpen} matches={matches} hasQuery={!!q}
                    onToggle={(id, open) => setToggled((t) => ({ ...t, [id]: open }))} onFocus={go} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {!nodes && !error && <div className="h-64 animate-pulse rounded-2xl bg-white" />}
    </div>
  );
}

type Tree = { children: Map<number, TreeNode[]>; team: Map<number, number> };

/** Children per member, team size (all descendants) and the root(s) of a node list. */
export function buildTree(nodes: TreeNode[]) {
  const byId = new Map<number, TreeNode>();
  const children = new Map<number, TreeNode[]>();
  for (const n of nodes) byId.set(n.id, n);
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    if (n.parentId === null || !byId.has(n.parentId)) roots.push(n);
    else children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  }
  const team = new Map<number, number>();
  const count = (id: number): number => {
    if (team.has(id)) return team.get(id)!;
    const t = (children.get(id) ?? []).reduce((s, c) => s + 1 + count(c.id), 0);
    team.set(id, t);
    return t;
  };
  roots.forEach((r) => count(r.id));
  return { byId, children, roots, team };
}

/**
 * Compact tree of one member's network (no search / stats), fully expanded —
 * used inside other screens. "Tree from here" opens the Referral Tree page.
 */
export function NetworkTree({ root, treePath }: { root: string; treePath: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [nodes, setNodes] = useState<TreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    authFetch<{ nodes: TreeNode[] }>(`/api/customers/referral-tree?root=${encodeURIComponent(root)}`, { signal: controller.signal }).then(
      (r) => { setNodes(r.nodes); setToggled({}); },
      (err) => { if ((err as Error).name !== "AbortError") setError(errorMessage(err)); },
    );
    return () => controller.abort();
  }, [authFetch, root]);

  const tree = useMemo(() => buildTree(nodes ?? []), [nodes]);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!nodes) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  return (
    <div>
      <ul className="@container/tree space-y-1">
        {tree.roots.map((n) => (
          <Branch key={n.id} node={n} tree={tree} isOpen={(x) => toggled[x.id] ?? x.depth < 6} matches={new Set()} hasQuery={false}
            onToggle={(id, open) => setToggled((t) => ({ ...t, [id]: open }))} onFocus={(no) => router.push(`${treePath}?root=${no}`)} />
        ))}
      </ul>
    </div>
  );
}

function Branch({ node, tree, isOpen, matches, hasQuery, onToggle, onFocus }: {
  node: TreeNode;
  tree: Tree;
  isOpen: (n: TreeNode) => boolean;
  matches: Set<number>;
  hasQuery: boolean;
  onToggle: (id: number, open: boolean) => void;
  onFocus: (accountNo: string) => void;
}) {
  const kids = tree.children.get(node.id) ?? [];
  const open = isOpen(node);
  const team = tree.team.get(node.id) ?? 0;
  const pays = node.depth >= 1 && node.depth <= COMMISSION_DEPTH;
  const hit = matches.has(node.id);

  return (
    <li className={node.depth === 0 ? "" : "relative pl-4 before:absolute before:top-0 before:left-0 before:h-full before:border-l before:border-slate-300 after:absolute after:top-6 after:left-0 after:w-3 after:border-t after:border-slate-300 last:before:h-6 @lg/tree:pl-7 @lg/tree:after:w-6"}>
      {/* the row adapts to its own width: figures beside the name when wide, under it when narrow */}
      <div style={{ animationDelay: `${Math.min(node.depth, 6) * 40}ms` }} className={`referral-node-enter @container/row rounded-xl border px-2 py-2 @lg/tree:px-2.5 ${hit ? "border-amber-300 bg-amber-50" : hasQuery ? "border-transparent opacity-60" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
        <div className="flex items-center gap-2">
          {kids.length > 0 ? (
            <button type="button" onClick={() => onToggle(node.id, !open)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
              className="grid size-6 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-200">
              <Icon name={open ? "chevronDown" : "chevronRight"} className="size-4" />
            </button>
          ) : <span className="size-6 shrink-0" />}

          <span className={`hidden size-9 shrink-0 place-items-center rounded-full text-sm font-semibold @xs/row:grid ${node.depth === 0 ? "bg-navy text-white" : "bg-brand-soft text-brand"}`}>
            {node.name.charAt(0)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {node.visible ? (
                <Link href={`/admin/accounts/${node.accountNo}`} className="min-w-0 font-medium break-words text-navy hover:text-brand hover:underline">{node.name}</Link>
              ) : <span className="min-w-0 font-medium break-words text-navy">{node.name}</span>}
              {node.depth > 0 && (
                <span title={pays ? `Level ${node.depth} — deposits pay the top member` : `Level ${node.depth} — too deep for commission to the top member`}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${pays ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>
                  L{node.depth}
                </span>
              )}
              {node.kycStatus !== "VERIFIED" && <KycStatusBadge status={node.kycStatus} />}
            </div>
            <p className="truncate font-mono text-[11px] text-slate-500">
              {node.accountNo}
              {!node.visible && <span className="font-sans"> · {node.office.name} office</span>}
            </p>
            {/* narrow: one compact line of figures */}
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-600 tabular-nums @xl/row:hidden">
              {node.balance !== null && <span>Bal <b className="font-medium text-navy">{money(node.balance)}</b></span>}
              {node.commissionEarned !== null && <span>Earned <b className="font-medium text-emerald-700">{money(node.commissionEarned)}</b></span>}
              <span>Team <b className="font-medium text-navy">{node.directCount}/{team}</b></span>
            </p>
          </div>

          {/* wide: figures in columns */}
          <dl className="hidden shrink-0 grid-cols-3 gap-4 text-right text-xs @xl/row:grid">
            <div><dt className="text-slate-400">Balance</dt><dd className="font-medium text-navy tabular-nums">{node.balance === null ? "—" : money(node.balance)}</dd></div>
            <div><dt className="text-slate-400">Earned</dt><dd className="font-medium text-emerald-700 tabular-nums">{node.commissionEarned === null ? "—" : money(node.commissionEarned)}</dd></div>
            <div><dt className="text-slate-400">Team</dt><dd className="font-medium text-navy tabular-nums">{node.directCount} / {team}</dd></div>
          </dl>

          {node.depth > 0 && (
            <button type="button" onClick={() => onFocus(node.accountNo)} title="Show the tree from this member" aria-label={`Show the tree from ${node.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-brand hover:bg-brand-soft @3xl/row:flex @3xl/row:w-auto @3xl/row:px-2.5 @3xl/row:text-xs">
              <Icon name="users" className="size-4 @3xl/row:hidden" />
              <span className="hidden @3xl/row:inline">Tree from here</span>
            </button>
          )}
        </div>
      </div>

      {open && kids.length > 0 && (
        <ul className="mt-1 ml-[11px] space-y-1">
          {kids.map((c) => (
            <Branch key={c.id} node={c} tree={tree} isOpen={isOpen} matches={matches} hasQuery={hasQuery} onToggle={onToggle} onFocus={onFocus} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-navy tabular-nums">{value}</dd>
    </div>
  );
}
