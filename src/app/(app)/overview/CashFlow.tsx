"use client";

import { money } from "@/lib/utils";
import type { Period } from "@/lib/period";

/** In-vs-out bars. Days for a week, weeks for a month, months for a financial year. */
export function CashFlow({ period, payments, income, expenses, from }: {
  period: Period; payments: any[]; income: any[]; expenses: any[]; from: string;
}) {
  const start = new Date(from);
  let buckets: { label: string; inAmt: number; outAmt: number }[] = [];

  if (period === "week") {
    buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), inAmt: 0, outAmt: 0, _d: d } as any;
    });
  } else if (period === "month") {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let i = 0; i < Math.ceil(end / 7); i++) buckets.push({ label: `W${i + 1}`, inAmt: 0, outAmt: 0 });
  } else {
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      buckets.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), inAmt: 0, outAmt: 0 });
    }
  }

  const idx = (dateStr: string) => {
    const d = new Date(dateStr);
    if (period === "week") return Math.floor((+d - +start) / 86400000);
    if (period === "month") return Math.floor((d.getDate() - 1) / 7);
    return (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
  };
  const put = (dateStr: string, amt: number, dir: "in" | "out") => {
    const i = idx(dateStr);
    if (i < 0 || i >= buckets.length) return;
    if (dir === "in") buckets[i].inAmt += amt; else buckets[i].outAmt += amt;
  };

  payments.forEach((p) => put(p.paid_on, Number(p.amount), "in"));
  income.forEach((e) => put(e.entry_date, Number(e.amount), "in"));
  expenses.forEach((e) => put(e.entry_date, Number(e.amount), "out"));

  const max = Math.max(...buckets.map((b) => Math.max(b.inAmt, b.outAmt)), 1);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Cash flow</h2>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-emerald-600" />In
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--copper)" }} />Out
          </span>
        </div>
      </div>
      <div className="mt-5 flex h-36 items-end gap-2">
        {buckets.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end justify-center gap-[3px]">
              <div className="w-1/2 rounded-t bg-emerald-600" title={`In ${money(b.inAmt)}`}
                   style={{ height: `${(b.inAmt / max) * 100}%`, minHeight: b.inAmt ? 3 : 0 }} />
              <div className="w-1/2 rounded-t" title={`Out ${money(b.outAmt)}`}
                   style={{ height: `${(b.outAmt / max) * 100}%`, minHeight: b.outAmt ? 3 : 0, background: "var(--copper)" }} />
            </div>
            <span className="text-[11px] text-muted">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
