import type { StatementPage } from "./types";
import { formatDateTime } from "@/lib/auth/types";
import { modeLabel } from "@/lib/deposits/types";

/** Pure CSV generation plus the browser download adapter, reusable by both panels. */
export class TransactionCsvExporter {
  build(report: StatementPage): string {
    const headers = ["Date & Time", "Receipt No.", "Particulars", "Mode / Reference", "By", "Debit", "Credit", "Balance"];
    if (report.summary) headers.push("Operator ID", "Operator Username", "Operator Role", "Office");
    const rows = report.items.map((t) => {
      const description = t.kind === "OPENING" ? "Opening amount" : t.remarks ?? (t.kind === "WITHDRAWAL" ? "Withdrawal" : t.kind === "INTEREST" ? "Interest" : "Deposit");
      const row = [formatDateTime(t.at), t.receiptNo, description,
        [modeLabel(t.mode), t.referenceNo].filter(Boolean).join(" / "), t.createdBy, t.debit, t.credit, t.balanceAfter];
      if (report.summary) row.push(String(t.operator?.id ?? ""), t.operator?.username ?? "", t.operator?.role ?? "SYSTEM", t.office ? `${t.office.city} – ${t.office.name}` : "");
      return row;
    });
    return "\uFEFF" + [headers, ...rows].map((row) => row.map(TransactionCsvExporter.cell).join(",")).join("\r\n");
  }
  download(accountNo: string, report: StatementPage): void {
    const url = URL.createObjectURL(new Blob([this.build(report)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${accountNo}-all-transactions.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private static cell(value: string): string {
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }
}
