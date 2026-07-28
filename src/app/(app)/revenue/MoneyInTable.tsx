"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusChip } from "@/components/ui/StatusChip";
import { money, fmtDate } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export type MoneyInRow = {
  id: string; date: string; source: string; who: string;
  method: string; amount: number; status?: string; manual: boolean;
};

/**
 * Money in had no delete at all — a mistyped cash entry could only be removed
 * from the Money out screen, which is where it confusingly appeared. Manual
 * entries can be deleted here now.
 *
 * Invoice payments deliberately cannot: deleting one would silently desync
 * `invoices.amount_paid`, which a database trigger maintains. Those get voided
 * from the invoice itself.
 */
export function MoneyInTable({ rows: initial, canDelete, period }: {
  rows: MoneyInRow[]; canDelete: boolean; period: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  /**
   * The rows come straight from props, NOT copied into state.
   *
   * This used to be `useState(initial)`, which snapshots the server data once on
   * mount. Switching the Week/Month/FY toggle re-renders the page with new props
   * but React keeps the original state — so the totals above updated while the
   * table below kept showing the first period it ever loaded. On a week with no
   * entries that read "Nothing received" underneath a non-zero total.
   *
   * Optimistic delete is handled with a set of removed ids instead, so props
   * stay the single source of truth.
   */
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const rows = initial.filter((r) => !removed.has(r.id));

  async function remove(r: MoneyInRow) {
    if (!confirm(`Delete this entry (${r.who} · ${money(r.amount)})? This cannot be undone.`)) return;
    setRemoved((s) => new Set(s).add(r.id));
    const { error: err } = await supabase.from("finance_entries").delete().eq("id", r.id);
    if (err) {
      setRemoved((s) => { const n = new Set(s); n.delete(r.id); return n; });
      setError(err.message.toLowerCase().includes("row-level security")
        ? "You don't have permission to delete that entry."
        : err.message);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}
      <table className="w-full">
        <thead><tr className="border-b border-line">
          <th className="th">Date</th><th className="th">Source</th><th className="th">Client / note</th>
          <th className="th">Method</th><th className="th">Status</th>
          <th className="th text-right">Amount</th><th className="th" />
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="td whitespace-nowrap text-muted">{fmtDate(r.date)}</td>
              <td className="td">
                {r.source}
                {r.manual && <span className="chip ml-2 bg-black/5 text-muted">manual</span>}
              </td>
              <td className="td">{r.who}</td>
              <td className="td text-muted">{r.method}</td>
              <td className="td">
                {r.status ? <StatusChip status={r.status} /> : <span className="text-muted">—</span>}
              </td>
              <td className="td text-right font-medium text-emerald-700">+{money(r.amount)}</td>
              <td className="td text-right">
                {r.manual && canDelete && (
                  <button className="btn-ghost px-2" title="Delete this entry"
                          aria-label="Delete this entry" onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4 text-muted hover:text-red-600" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="td text-muted" colSpan={7}>Nothing received this {period}.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
