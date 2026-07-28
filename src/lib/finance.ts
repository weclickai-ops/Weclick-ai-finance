import type { Invoice, InvoicePayment, FinanceEntry, Payable } from "./types";
import { periodStart, previousWindow, type Period } from "./period";

export interface Book {
  invoices: Invoice[];
  payments: InvoicePayment[];
  entries: FinanceEntry[];
  payables: Payable[];
}

const within = (d: string | null, from: Date, to?: Date) => {
  if (!d) return false;
  const x = new Date(d);
  return x >= from && (!to || x < to);
};

export function summarise(book: Book, period: Period) {
  const from = periodStart(period);
  const prev = previousWindow(period);
  const approved = book.entries.filter((e) => e.status === "approved");

  const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);

  const revenue = sum(book.payments.filter((p) => within(p.paid_on, from)).map((p) => Number(p.amount)));
  const prevRevenue = sum(book.payments.filter((p) => within(p.paid_on, prev.from, prev.to)).map((p) => Number(p.amount)));
  const manualIncome = sum(approved.filter((e) => e.kind === "income" && within(e.entry_date, from)).map((e) => Number(e.amount)));
  const spent = sum(approved.filter((e) => e.kind === "expense" && within(e.entry_date, from)).map((e) => Number(e.amount)));
  const prevSpent = sum(approved.filter((e) => e.kind === "expense" && within(e.entry_date, prev.from, prev.to)).map((e) => Number(e.amount)));
  const gstHeld = sum(approved.filter((e) => e.kind === "gst_setaside" && within(e.entry_date, from)).map((e) => Number(e.amount)));

  const open = book.invoices.filter((i) => !["void", "written_off", "draft"].includes(i.status));
  const owedToUs = sum(open.map((i) => Math.max(0, Number(i.total) - Number(i.amount_paid))));
  const weOwe = sum(book.payables.map((p) => Number(p.amount)));

  const moneyIn = revenue + manualIncome;
  return {
    from, revenue, manualIncome, moneyIn, spent, gstHeld, owedToUs, weOwe,
    net: moneyIn - spent,
    prevNet: prevRevenue - prevSpent,
    paymentsInPeriod: book.payments.filter((p) => within(p.paid_on, from)),
    incomeInPeriod: approved.filter((e) => e.kind === "income" && within(e.entry_date, from)),
    expensesInPeriod: approved.filter((e) => e.kind === "expense" && within(e.entry_date, from)),
  };
}

export function byCategory(entries: FinanceEntry[]) {
  const m = new Map<string, number>();
  entries.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function isOverdue(inv: Invoice) {
  const balance = Number(inv.total) - Number(inv.amount_paid);
  return balance > 0 && !!inv.due_date && new Date(inv.due_date) < new Date()
    && !["void", "written_off", "draft"].includes(inv.status);
}

export function daysOverdue(inv: Invoice) {
  if (!inv.due_date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000));
}

/**
 * Loads the book.
 *
 * `since` is the performance fix. Every page used to pull EVERY payment and up
 * to 1000 entries and then filter them in JavaScript — on Overview, Reports,
 * Money in, Money out and Dues alike, with force-dynamic so nothing cached.
 * Now each page asks only for the window it actually renders, and Postgres does
 * the filtering.
 *
 * Invoices are still fetched whole, on purpose: Dues needs every unpaid invoice
 * however old it is. Void and written-off ones are dropped, which is most of the
 * dead weight.
 */
export async function loadBook(
  supabase: any,
  opts: { since?: string | Date; until?: string | Date } = {}
): Promise<Book> {
  const iso = (d?: string | Date) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : d;
  const since = iso(opts.since);
  const until = iso(opts.until);

  let payQ = supabase
    .from("invoice_payments")
    .select("*")
    .order("paid_on", { ascending: false });
  if (since) payQ = payQ.gte("paid_on", since);
  if (until) payQ = payQ.lte("paid_on", until);

  let entQ = supabase
    .from("finance_entries")
    .select("*")
    .order("entry_date", { ascending: false });
  if (since) entQ = entQ.gte("entry_date", since);
  if (until) entQ = entQ.lte("entry_date", until);
  if (!since) entQ = entQ.limit(1000);

  const [inv, pay, ent, pby] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, client_name, currency, subtotal, tax_percent, total, amount_paid, status, due_date, paid_at, created_at")
      .not("status", "in", "(void,written_off)")
      .order("created_at", { ascending: false }),
    payQ,
    entQ,
    supabase.from("payables").select("*").eq("paid", false).order("due_date"),
  ]);

  return {
    invoices: inv.data ?? [], payments: pay.data ?? [],
    entries: ent.data ?? [], payables: pby.data ?? [],
  };
}
