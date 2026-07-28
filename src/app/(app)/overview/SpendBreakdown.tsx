"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/utils";
import { ArrowUp, ArrowDown, Search, Minus } from "lucide-react";

export type CatRow = {
  name: string;
  color: string;
  amount: number;
  prevAmount: number;
  count: number;
};

type SortKey = "amount" | "name" | "change" | "count";

/**
 * Where the money actually goes, as a table you can sort and filter.
 *
 * The bar chart it replaces showed relative size but answered none of the
 * questions you actually ask at month end: what share of spend is this, is it
 * growing, and how many entries make it up. A category that doubled looked
 * identical to one that halved.
 */
export function SpendBreakdown({
  rows, totalIn, totalOut, periodWord,
}: {
  rows: CatRow[]; totalIn: number; totalOut: number; periodWord: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("amount");
  const [asc, setAsc] = useState(false);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows;
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      if (sort === "count") return (a.count - b.count) * dir;
      if (sort === "change") return (changeOf(a) - changeOf(b)) * dir;
      return (a.amount - b.amount) * dir;
    });
  }, [rows, q, sort, asc]);

  const shownTotal = shown.reduce((s, r) => s + r.amount, 0);
  const kept = totalIn - totalOut;
  // What share of what came in you actually kept. The single number that says
  // whether a good month was good.
  const keptPct = totalIn > 0 ? Math.round((kept / totalIn) * 100) : null;

  function head(key: SortKey, label: string, right = false) {
    const active = sort === key;
    return (
      <th className={`th cursor-pointer select-none ${right ? "text-right" : ""}`}
          onClick={() => { active ? setAsc(!asc) : (setSort(key), setAsc(false)); }}>
        <span className={`inline-flex items-center gap-1 ${active ? "text-ink" : ""}`}>
          {label}
          {active && (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </th>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold">Where the money goes</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {money(totalIn)} in · {money(totalOut)} out ·{" "}
            <span className={kept >= 0 ? "text-emerald-700" : "text-red-600"}>
              {kept >= 0 ? "kept" : "short"} {money(Math.abs(kept))}
              {keptPct !== null && ` (${keptPct}%)`}
            </span>
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            className="input w-44 py-1.5 pl-8 text-[13px]"
            placeholder="Filter categories"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line">
            {head("name", "Category")}
            {head("count", "Entries", true)}
            {head("amount", "Spent", true)}
            <th className="th text-right">Share</th>
            {head("change", `vs last ${periodWord}`, true)}
            <th className="th" />
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const share = totalOut > 0 ? (r.amount / totalOut) * 100 : 0;
              const chg = changeOf(r);
              return (
                <tr key={r.name} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                  <td className="td">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="font-medium">{r.name}</span>
                    </span>
                  </td>
                  <td className="td text-right text-muted">{r.count}</td>
                  <td className="td text-right font-medium">{money(r.amount)}</td>
                  <td className="td text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-black/5 sm:block">
                        <span className="block h-full rounded-full"
                              style={{ width: `${share}%`, background: r.color }} />
                      </span>
                      <span className="w-10 text-right text-muted">{share.toFixed(0)}%</span>
                    </span>
                  </td>
                  <td className="td text-right">
                    <Change value={chg} prev={r.prevAmount} />
                  </td>
                  <td className="td text-right">
                    <Link href={`/expenses?period=month`}
                          className="text-xs text-copper hover:underline">view</Link>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>
                {q ? `No category matches "${q}".` : `No approved expenses this ${periodWord}.`}
              </td></tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-black/[0.015]">
                <td className="td font-semibold">{q ? "Filtered total" : "Total"}</td>
                <td className="td text-right text-muted">
                  {shown.reduce((s, r) => s + r.count, 0)}
                </td>
                <td className="td text-right font-semibold">{money(shownTotal)}</td>
                <td className="td text-right text-muted">
                  {totalOut > 0 ? `${Math.round((shownTotal / totalOut) * 100)}%` : "—"}
                </td>
                <td className="td" /><td className="td" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** Percent change, or null when there is no baseline to compare against. */
function changeOf(r: CatRow): number {
  if (r.prevAmount === 0) return r.amount > 0 ? Infinity : 0;
  return ((r.amount - r.prevAmount) / r.prevAmount) * 100;
}

function Change({ value, prev }: { value: number; prev: number }) {
  if (prev === 0 && value === 0) return <span className="text-muted">—</span>;
  if (!isFinite(value)) return <span className="text-[13px] text-muted">new</span>;
  if (Math.round(value) === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-muted">
        <Minus className="h-3 w-3" /> flat
      </span>
    );
  }
  const up = value > 0;
  // More spending is not good news, so up is the warning colour here.
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] ${up ? "text-copper" : "text-emerald-700"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(Math.round(value))}%
    </span>
  );
}
