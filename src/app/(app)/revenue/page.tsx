import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { PeriodToggle } from "@/components/PeriodToggle";
import { MoneyInTable, type MoneyInRow } from "./MoneyInTable";
import { loadBook, summarise } from "@/lib/finance";
import { periodStart, periodLabel, type Period } from "@/lib/period";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Money in = invoice payments AND manual cash/offline income.
 *
 * This page used to list only `invoice_payments`, so anything logged as
 * "Money in (cash / offline)" on the Money out screen was invisible here even
 * though summarise() counted it in the totals. Cash income was being recorded
 * and then silently not shown.
 */
export default async function RevenuePage({
  searchParams,
}: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = (sp.period === "month" ? "month" : "week") as Period;
  const supabase = await createClient();

  // Only load the window being rendered — see loadBook in lib/finance.ts.
  const book = await loadBook(supabase, { since: periodStart(period) });
  const s = summarise(book, period);

  const { data: me } = await supabase
    .from("finance_users").select("role").eq("id", (await supabase.auth.getUser()).data.user!.id).maybeSingle();
  const canDelete = me?.role === "owner" || me?.role === "accountant";

  const rows: MoneyInRow[] = [
    ...s.paymentsInPeriod.map((p) => {
      const inv = book.invoices.find((i) => i.id === p.invoice_id);
      return {
        id: p.id,
        date: p.paid_on,
        source: inv?.number ?? "Payment",
        who: inv?.client_name ?? "—",
        method: p.method + (p.reference ? ` · ${p.reference}` : ""),
        amount: Number(p.amount),
        status: inv?.status,
        manual: false,
      };
    }),
    ...s.incomeInPeriod.map((e) => ({
      id: e.id,
      date: e.entry_date,
      source: "Cash / offline",
      who: e.note || e.category,
      method: e.method ?? "—",
      amount: Number(e.amount),
      manual: true,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const partial = book.invoices.filter((i) => i.status === "partially_paid");

  return (
    <>
      <PageHeader
        title="Money in"
        subtitle={`Invoice payments and cash · ${periodLabel(period)}`}
        action={<PeriodToggle value={period} />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[13px] text-muted">From invoices</p>
          <p className="mt-1 font-display text-xl font-semibold">{money(s.revenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Cash / offline</p>
          <p className="mt-1 font-display text-xl font-semibold">{money(s.manualIncome)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Total in</p>
          <p className="mt-1 font-display text-xl font-semibold text-emerald-700">{money(s.moneyIn)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold">Received</h2>
          <span className="font-display text-base font-semibold">{money(s.moneyIn)}</span>
        </div>
        <MoneyInTable rows={rows} canDelete={canDelete} period={period} />
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
