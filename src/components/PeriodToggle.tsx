"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Period } from "@/lib/period";

const OPTS: { v: Period; l: string }[] = [
  { v: "week", l: "Week" }, { v: "month", l: "Month" }, { v: "year", l: "FY" },
];

export function PeriodToggle({ value }: { value: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(p: Period) {
    const q = new URLSearchParams(params.toString());
    q.set("period", p);
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {OPTS.map((o) => (
        <button key={o.v} onClick={() => set(o.v)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === o.v ? "bg-copper text-white" : "text-muted hover:text-ink"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
