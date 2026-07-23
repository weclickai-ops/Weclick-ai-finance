import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { PeriodToggle } from "@/components/PeriodToggle";
import { StatusChip } from "@/components/ui/StatusChip";
import { loadBook, summarise } from "@/lib/finance";
import { periodLabel, type Period } from "@/lib/period";
import { money, fmtDate } from "@/lib/utils";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = (sp.period === "month" ? "month" : "week") as Period;
  const supabase = await createClient();
  const book = await loadBook(supabase);
  const s = summarise(book, period);

  const partial = book.invoices.filter((i) => i.status === "partially_paid");

  return (
    <>
      <PageHeader title="Revenue" subtitle={`Payments received · ${periodLabel(period)}`}
                  action={<PeriodToggle value={period} />} />

      <div className="mb-5 flex items-center gap-2 rounded-xl2 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
        <Check className="h-4 w-4" />
        Read straight from the CRM payment ledger — nothing is entered twice.
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold">Payments received</h2>
          <span className="font-display text-base font-semibold">{money(s.revenue)}</span>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">Date</th><th className="th">Invoice</th><th className="th">Client</th>
            <th className="th">Method</th><th className="th">Invoice status</th><th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {s.paymentsInPeriod.map((p) => {
              const inv = book.invoices.find((i) => i.id === p.invoice_id);
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="td whitespace-nowrap text-muted">{fmtDate(p.paid_on)}</td>
                  <td className="td">{inv?.number ?? "—"}</td>
                  <td className="td">{inv?.client_name ?? "—"}</td>
                  <td className="td text-muted">{p.method}{p.reference ? ` · ${p.reference}` : ""}</td>
                  <td className="td">{inv && <StatusChip status={inv.status} />}</td>
                  <td className="td text-right font-medium text-emerald-700">+{money(Number(p.amount))}</td>
                </tr>
              );
            })}
            {s.paymentsInPeriod.length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>No payments received this {period}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {partial.length > 0 && (
        <div className="card mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Part-paid invoices</h2>
          <ul className="mt-3 divide-y divide-line">
            {partial.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{i.number} · <span className="text-muted">{i.client_name}</span></span>
                <span className="text-muted">
                  {money(Number(i.amount_paid), i.currency)} of {money(Number(i.total), i.currency)} ·{" "}
                  <strong className="text-ink">{money(Number(i.total) - Number(i.amount_paid), i.currency)} outstanding</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
