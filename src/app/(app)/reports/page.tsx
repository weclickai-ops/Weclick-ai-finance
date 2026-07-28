import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { loadBook, byCategory } from "@/lib/finance";
import { ReportsClient } from "./ReportsClient";
import { DateRange } from "./DateRange";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Default window: the six months ending today. */
function defaultRange() {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return { from: iso(from), to: iso(to) };
}

export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const def = defaultRange();

  // Fall back to the default on anything unparseable rather than throwing.
  const valid = (s?: string) => (s && !isNaN(new Date(s).getTime()) ? s : undefined);
  let from = valid(sp.from) ?? def.from;
  let to = valid(sp.to) ?? def.to;
  if (new Date(from) > new Date(to)) [from, to] = [to, from];

  const supabase = await createClient();
  const book = await loadBook(supabase, { since: from, until: to });

  // One bucket per calendar month across the chosen range.
  const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
  const cursor = new Date(from);
  cursor.setDate(1);
  const end = new Date(to);
  while (cursor <= end && months.length < 36) {
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      revenue: 0,
      expenses: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const bucket = (dateStr: string) => {
    const d = new Date(dateStr);
    return months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
  };

  book.payments.forEach((p) => {
    const m = bucket(p.paid_on);
    if (m) m.revenue += Number(p.amount);
  });
  // Cash income counts as revenue here too — it did not before, which is why
  // the P&L could read zero while money had genuinely come in.
  book.entries
    .filter((e) => e.status === "approved" && e.kind === "income")
    .forEach((e) => {
      const m = bucket(e.entry_date);
      if (m) m.revenue += Number(e.amount);
    });
  book.entries
    .filter((e) => e.status === "approved" && e.kind === "expense")
    .forEach((e) => {
      const m = bucket(e.entry_date);
      if (m) m.expenses += Number(e.amount);
    });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  const gstCollected = book.invoices
    .filter((i) => !["void", "written_off", "draft"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total) - Number(i.subtotal)), 0);
  const gstSetAside = book.entries
    .filter((e) => e.status === "approved" && e.kind === "gst_setaside")
    .reduce((s, e) => s + Number(e.amount), 0);

  const cats = byCategory(
    book.entries.filter((e) => e.status === "approved" && e.kind === "expense")
  );

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${fmt(from)} to ${fmt(to)} · export for your accountant`}
        action={<DateRange from={from} to={to} defaultFrom={def.from} defaultTo={def.to} />}
      />
      <ReportsClient
        months={months} totalRevenue={totalRevenue} totalExpenses={totalExpenses}
        gstCollected={gstCollected} gstSetAside={gstSetAside} categories={cats}
        payments={book.payments} invoices={book.invoices} entries={book.entries}
      />
    </>
  );
}
