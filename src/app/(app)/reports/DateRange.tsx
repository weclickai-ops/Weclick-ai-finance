"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, X } from "lucide-react";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Ready-made windows, because most of the time you want one of these. */
function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // Indian financial year runs 1 Apr – 31 Mar
  const fyStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1);
  return [
    { label: "This month", from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { label: "Last 3 months", from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: "Last 6 months", from: iso(new Date(y, m - 5, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: "This financial year", from: iso(fyStart), to: iso(new Date(y, m + 1, 0)) },
  ];
}

export function DateRange({
  from, to, defaultFrom, defaultTo,
}: { from: string; to: string; defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const isDefault = from === defaultFrom && to === defaultTo;

  function apply(nextFrom: string, nextTo: string) {
    router.push(`/reports?from=${nextFrom}&to=${nextTo}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button className="btn-outline text-sm" onClick={() => setOpen((v) => !v)}>
        <Calendar className="h-4 w-4" /> Change dates
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl2 border border-line bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium">Pick a range</p>
            <button onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>

          <div className="mt-3 space-y-1">
            {presets().map((p) => (
              <button
                key={p.label}
                onClick={() => apply(p.from, p.to)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-black/[0.04]"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-[13px] font-medium">Or set your own</p>
            <div className="flex items-center gap-2">
              <input type="date" className="input text-[13px]" value={f} onChange={(e) => setF(e.target.value)} />
              <span className="text-muted">to</span>
              <input type="date" className="input text-[13px]" value={t} onChange={(e) => setT(e.target.value)} />
            </div>
            <button className="btn-primary mt-3 w-full text-sm" onClick={() => apply(f, t)}>
              Apply
            </button>
          </div>

          {!isDefault && (
            <button
              className="mt-2 w-full text-center text-xs text-muted hover:text-ink"
              onClick={() => apply(defaultFrom, defaultTo)}
            >
              Back to the last 6 months
            </button>
          )}
        </div>
      )}
    </div>
  );
}
