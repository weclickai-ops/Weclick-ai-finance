"use client";

import { money } from "@/lib/utils";
import { Download } from "lucide-react";

function toCSV(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({ months, totalRevenue, totalExpenses, gstCollected, gstSetAside, categories, payments, invoices, entries }: any) {
  const net = totalRevenue - totalExpenses;
  const stillToReserve = Math.max(0, gstCollected - gstSetAside);
  const max = Math.max(...months.map((m: any) => Math.max(m.revenue, m.expenses)), 1);

  function exportPL() {
    const rows: (string | number)[][] = [["Month", "Revenue", "Expenses", "Net"]];
    months.forEach((m: any) => rows.push([m.label, m.revenue, m.expenses, m.revenue - m.expenses]));
    rows.push(["Total", totalRevenue, totalExpenses, net]);
    download("weclick-profit-and-loss.csv", toCSV(rows));
  }
  function exportPayments() {
    const rows: (string | number)[][] = [["Date", "Invoice", "Client", "Method", "Reference", "Amount"]];
    payments.forEach((p: any) => {
      const inv = invoices.find((i: any) => i.id === p.invoice_id);
      rows.push([p.paid_on, inv?.number ?? "", inv?.client_name ?? "", p.method, p.reference ?? "", Number(p.amount)]);
    });
    download("weclick-payments.csv", toCSV(rows));
  }
  function exportExpenses() {
    const rows: (string | number)[][] = [["Date", "Kind", "Category", "Note", "Status", "Amount"]];
    entries.forEach((e: any) => rows.push([e.entry_date, e.kind, e.category, e.note ?? "", e.status, Number(e.amount)]));
    download("weclick-expenses.csv", toCSV(rows));
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-display text-base font-semibold">Revenue vs expenses</h2>
        <div className="mt-5 flex h-40 items-end gap-3">
          {months.map((m: any) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-1/2 rounded-t bg-emerald-600" style={{ height: `${(m.revenue / max) * 100}%` }} title={money(m.revenue)} />
                <div className="w-1/2 rounded-t" style={{ height: `${(m.expenses / max) * 100}%`, background: "var(--copper)" }} title={money(m.expenses)} />
              </div>
              <span className="text-[11px] text-muted">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted">
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-emerald-600" />Revenue</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: "var(--copper)" }} />Expenses</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Profit &amp; loss</h2>
          <p className="mt-0.5 text-xs text-muted">Payments received less approved expenses</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              <tr><td className="py-1.5 text-muted">Revenue</td><td className="py-1.5 text-right">{money(totalRevenue)}</td></tr>
              <tr><td className="py-1.5 text-muted">Expenses</td><td className="py-1.5 text-right">−{money(totalExpenses)}</td></tr>
              <tr className="border-t border-line">
                <td className="py-2 font-semibold">Net</td>
                <td className={`py-2 text-right font-semibold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(net)}</td>
              </tr>
            </tbody>
          </table>
          <button className="btn-outline mt-4 w-full" onClick={exportPL}><Download className="h-4 w-4" /> Download CSV</button>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">GST</h2>
          <p className="mt-0.5 text-xs text-muted">Tax charged on invoices vs what you&apos;ve reserved</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              <tr><td className="py-1.5 text-muted">Collected on invoices</td><td className="py-1.5 text-right">{money(gstCollected)}</td></tr>
              <tr><td className="py-1.5 text-muted">Set aside</td><td className="py-1.5 text-right">{money(gstSetAside)}</td></tr>
              <tr className="border-t border-line">
                <td className="py-2 font-semibold">Still to reserve</td>
                <td className={`py-2 text-right font-semibold ${stillToReserve > 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {money(stillToReserve)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            This is tax you collected on behalf of the government — it isn&apos;t profit.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Expenses by category</h2>
          <div className="flex gap-2">
            <button className="btn-outline px-3 py-1.5 text-xs" onClick={exportExpenses}>
              <Download className="h-3.5 w-3.5" /> Expenses CSV
            </button>
            <button className="btn-outline px-3 py-1.5 text-xs" onClick={exportPayments}>
              <Download className="h-3.5 w-3.5" /> Payments CSV
            </button>
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {categories.map(([c, a]: [string, number]) => (
              <tr key={c} className="border-b border-line last:border-0">
                <td className="py-2 text-muted">{c}</td>
                <td className="py-2 text-right">{money(a)}</td>
              </tr>
            ))}
            {categories.length === 0 && <tr><td className="py-3 text-muted">No approved expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
