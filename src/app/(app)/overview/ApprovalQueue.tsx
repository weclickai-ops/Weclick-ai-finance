"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, fmtDate } from "@/lib/utils";
import type { FinanceEntry } from "@/lib/types";
import { Check, X } from "lucide-react";

export function ApprovalQueue({ pending: initial, canApprove, team, meId }: {
  pending: FinanceEntry[]; canApprove: boolean;
  team: { id: string; full_name: string | null; email: string }[]; meId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, setPending] = useState(initial);

  const nameOf = (id: string | null) =>
    team.find((t) => t.id === id)?.full_name ?? team.find((t) => t.id === id)?.email ?? "—";

  async function decide(id: string, status: "approved" | "rejected") {
    setPending((p) => p.filter((e) => e.id !== id));
    await supabase.from("finance_entries").update({
      status, approved_by: meId, approved_at: new Date().toISOString(),
    }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-base font-semibold">Waiting for you</h2>
      <p className="mt-0.5 text-xs text-muted">Expenses logged by the team</p>
      <ul className="mt-4 space-y-2">
        {pending.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{money(Number(e.amount))} · {e.category}</p>
              <p className="truncate text-xs text-muted">
                {nameOf(e.logged_by)}{e.note ? ` · ${e.note}` : ""} · {fmtDate(e.entry_date)}
              </p>
            </div>
            {canApprove ? (
              <div className="flex gap-1.5">
                <button className="btn-outline px-2.5 py-1.5" onClick={() => decide(e.id, "approved")} title="Approve">
                  <Check className="h-4 w-4 text-emerald-700" />
                </button>
                <button className="btn-outline px-2.5 py-1.5" onClick={() => decide(e.id, "rejected")} title="Reject">
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            ) : <span className="chip bg-amber-100 text-amber-800">Pending</span>}
          </li>
        ))}
        {pending.length === 0 && <li className="py-3 text-sm text-muted">Nothing waiting — all caught up.</li>}
      </ul>
    </div>
  );
}
