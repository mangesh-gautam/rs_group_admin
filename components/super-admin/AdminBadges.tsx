import type { AdminAccount } from "@/lib/auth/types";

const STATUS_STYLE = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  LOCKED: "bg-red-50 text-red-700 ring-red-200",
} as const;

const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", LOCKED: "Locked" } as const;

export function StatusBadge({ admin }: { admin: Pick<AdminAccount, "status" | "temporarilyLocked"> }) {
  if (admin.status === "ACTIVE" && admin.temporarilyLocked) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
        Temporarily locked
      </span>
    );
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLE[admin.status]}`}>
      {STATUS_LABEL[admin.status]}
    </span>
  );
}

export function PasswordStateBadge({ mustChange }: { mustChange: boolean }) {
  return mustChange ? (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
      Must change password
    </span>
  ) : (
    <span className="text-[11px] text-slate-500">Password set</span>
  );
}
