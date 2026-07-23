import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { loadBook, byCategory } from "@/lib/finance";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const book = await loadBook(supabase);

  // group the last 6 months
  const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      revenue: 0, expenses: 0,
    });
  }
  const bucket = (dateStr: string) => {
    const d = new Date(dateStr);
    return months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
  };
  book.payments.forEach((p) => { const m = bucket(p.paid_on); if (m) m.revenue += Number(p.amount); });
  book.entries.filter((e) => e.status === "approved" && e.kind === "expense")
    .forEach((e) => { const m = bucket(e.entry_date); if (m) m.expenses += Number(e.amount); });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  // GST: collected on invoices vs set aside
  const gstCollected = book.invoices
    .filter((i) => !["void", "written_off", "draft"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total) - Number(i.subtotal)), 0);
  const gstSetAside = book.entries
    .filter((e) => e.status === "approved" && e.kind === "gst_setaside")
    .reduce((s, e) => s + Number(e.amount), 0);

  const cats = byCategory(book.entries.filter((e) => e.status === "approved" && e.kind === "expense"));

  return (
    <>
      <PageHeader title="Reports" subtitle="Last 6 months · export for your accountant" />
      <ReportsClient
        months={months} totalRevenue={totalRevenue} totalExpenses={totalExpenses}
        gstCollected={gstCollected} gstSetAside={gstSetAside} categories={cats}
        payments={book.payments} invoices={book.invoices} entries={book.entries}
      />
    </>
  );
}
