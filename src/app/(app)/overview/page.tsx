import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeam } from "@/lib/session";
import { PageHeader } from "../PageHeader";
import { PeriodToggle } from "@/components/PeriodToggle";
import { loadBook, summarise } from "@/lib/finance";
import { periodLabel, periodStart, periodWord, previousWindow, type Period } from "@/lib/period";
import { money, fmtDate } from "@/lib/utils";
import { ApprovalQueue } from "./ApprovalQueue";
import { CashFlow } from "./CashFlow";
import { SpendBreakdown, type CatRow } from "./SpendBreakdown";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = (["month", "year"].includes(sp.period ?? "") ? sp.period : "week") as Period;
  const supabase = await createClient();
  const { user, me } = await getSession();
  if (!user) redirect("/login");
  const team = await getTeam();

  // One window further back than we display, so every category can be compared
  // against the same period last time. Still bounded — see loadBook.
  const prev = previousWindow(period);
  const [book, { data: catRows }] = await Promise.all([
    loadBook(supabase, { since: prev.from }),
    supabase.from("finance_categories").select("name, color"),
  ]);
  const s = summarise(book, period);

  const colourOf = (name: string) =>
    (catRows ?? []).find((c: any) => c.name === name)?.color ?? "#8A8F98";

  // This period vs the one before it, per category.
  const inPeriod = s.expensesInPeriod;
  const prevExpenses = book.entries.filter(
    (e: any) => e.status === "approved" && e.kind === "expense"
      && new Date(e.entry_date) >= prev.from && new Date(e.entry_date) < prev.to
  );
  const tally = (list: any[]) => {
    const m = new Map<string, { amount: number; count: number }>();
    list.forEach((e) => {
      const cur = m.get(e.category) ?? { amount: 0, count: 0 };
      m.set(e.category, { amount: cur.amount + Number(e.amount), count: cur.count + 1 });
    });
    return m;
  };
  const now = tally(inPeriod);
  const before = tally(prevExpenses);
  const breakdown: CatRow[] = [...now.entries()]
    .map(([name, v]) => ({
      name,
      color: colourOf(name),
      amount: v.amount,
      count: v.count,
      prevAmount: before.get(name)?.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const pending = book.entries.filter((e) => e.status === "pending");
  const canApprove = me?.role === "owner" || me?.role === "accountant";

  const cash = s.incomeInPeriod.filter((e: any) => e.method === "Cash")
    .reduce((t: number, e: any) => t + Number(e.amount), 0);
  const manualOther = s.manualIncome - cash;
  const delta = s.net - s.prevNet;

  return (
    <>
      <PageHeader title="Overview" subtitle={periodLabel(period)} action={<PeriodToggle value={period} />} />

      {/* hero */}
      <div className="card overflow-hidden">
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-surface p-6">
            <p className="text-sm text-muted">Net this {periodWord(period)}</p>
            <p className={`mt-2 font-display text-[34px] font-semibold leading-none tracking-tight
                          ${s.net >= 0 ? "text-ink" : "text-red-600"}`}>
              {s.net >= 0 ? "+" : ""}{money(s.net)}
            </p>
            <p className="mt-2.5 text-xs text-muted">
              {delta >= 0 ? "▲" : "▼"} {money(Math.abs(delta))} vs last {periodWord(period)}
            </p>
          </div>
          <Link href={`/revenue?period=${period}`}
                className="bg-surface p-6 transition-colors hover:bg-black/[0.02]">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50">
                <ArrowDownLeft className="h-4 w-4 text-emerald-700" />
              </span>
              <p className="text-sm text-muted">Money in</p>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{money(s.moneyIn)}</p>
            <p className="mt-2.5 text-xs text-muted">
              {money(s.revenue)} invoiced · {money(s.manualIncome)} added by hand
            </p>
          </Link>
          <Link href={`/expenses?period=${period}`}
                className="bg-surface p-6 transition-colors hover:bg-black/[0.02]">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "var(--copper-soft)" }}>
                <ArrowUpRight className="h-4 w-4 text-copper" />
              </span>
              <p className="text-sm text-muted">Money out</p>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{money(s.spent)}</p>
            <p className="mt-2.5 text-xs text-muted">{s.expensesInPeriod.length} approved expenses</p>
          </Link>
        </div>
      </div>

      {/* where the money came from */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-700" />
            <p className="text-sm font-medium">From invoices</p>
          </div>
          <p className="mt-2 font-display text-xl font-semibold">{money(s.revenue)}</p>
          <p className="mt-1 text-xs text-muted">{s.paymentsInPeriod.length} payments · synced from the CRM</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-copper" />
            <p className="text-sm font-medium">Offline cash</p>
          </div>
          <p className="mt-2 font-display text-xl font-semibold">{money(cash)}</p>
          <p className="mt-1 text-xs text-muted">walk-ins, cash jobs — added by hand</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted" />
            <p className="text-sm font-medium">GST set aside</p>
          </div>
          <p className="mt-2 font-display text-xl font-semibold">{money(s.gstHeld)}</p>
          <p className="mt-1 text-xs text-muted">held for filing — not profit</p>
        </div>
      </div>

      <div className="mt-4">
        <CashFlow period={period} payments={s.paymentsInPeriod} income={s.incomeInPeriod}
                  expenses={s.expensesInPeriod} from={s.from.toISOString()} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Top categories</h2>
          <div className="mt-4 space-y-2.5">
            {breakdown.slice(0, 5).map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="w-24 shrink-0 truncate text-sm text-muted">{r.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full"
                       style={{ width: `${(r.amount / (breakdown[0]?.amount || 1)) * 100}%`, background: r.color }} />
                </div>
                <span className="w-20 shrink-0 text-right text-sm">{money(r.amount)}</span>
              </div>
            ))}
            {breakdown.length === 0 && (
              <p className="text-sm text-muted">No approved expenses this {periodWord(period)}.</p>
            )}
          </div>
        </div>
        <ApprovalQueue pending={pending} canApprove={canApprove} team={team ?? []} meId={user.id} />
      </div>

      <div className="mt-4">
        <SpendBreakdown
          rows={breakdown}
          totalIn={s.moneyIn}
          totalOut={s.spent}
          periodWord={periodWord(period)}
        />
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold">Recent money in</h2>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">Date</th><th className="th">Source</th>
            <th className="th">Method</th><th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {[
              ...s.paymentsInPeriod.map((p: any) => {
                const inv = book.invoices.find((i) => i.id === p.invoice_id);
                return { d: p.paid_on, src: `${inv?.number ?? "—"} · ${inv?.client_name ?? ""}`, m: p.method, a: Number(p.amount) };
              }),
              ...s.incomeInPeriod.map((e: any) => ({ d: e.entry_date, src: e.note || e.category, m: e.method ?? "Cash", a: Number(e.amount) })),
            ].sort((a, b) => +new Date(b.d) - +new Date(a.d)).slice(0, 8).map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="td whitespace-nowrap text-muted">{fmtDate(r.d)}</td>
                <td className="td">{r.src}</td>
                <td className="td text-muted">{r.m}</td>
                <td className="td text-right font-medium text-emerald-700">+{money(r.a)}</td>
              </tr>
            ))}
            {s.moneyIn === 0 && (
              <tr><td className="td text-muted" colSpan={4}>Nothing received this {periodWord(period)}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
