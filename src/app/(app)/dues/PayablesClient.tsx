"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, fmtDateFull } from "@/lib/utils";
import type { Payable } from "@/lib/types";
import { Plus, Check, Trash2 } from "lucide-react";

export function PayablesClient({ payables: initial, canEdit, meId }: {
  payables: Payable[]; canEdit: boolean; meId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", amount: "", due_date: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.label.trim() || !amt) return;
    const { data, error } = await supabase.from("payables").insert({
      label: form.label.trim(), amount: amt,
      due_date: form.due_date || null, created_by: meId,
    }).select().single();
    if (error) return;
    setRows([...rows, data]); setForm({ label: "", amount: "", due_date: "" }); setOpen(false);
    router.refresh();
  }
  async function settle(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from("payables").update({ paid: true }).eq("id", id);
    router.refresh();
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from("payables").delete().eq("id", id);
    router.refresh();
  }

  const overdue = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-base font-semibold">We owe</h2>
        {canEdit && (
          <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => setOpen(!open)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={add} className="space-y-3 border-b border-line bg-black/[0.015] p-4">
          <input className="input" placeholder="GST — July" value={form.label}
                 onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" placeholder="41500" value={form.amount}
                   onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className="input" type="date" value={form.due_date}
                   onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-line">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.label}</p>
              <p className="mt-0.5 text-xs text-muted">
                {p.due_date
                  ? overdue(p.due_date)
                    ? <span className="chip bg-red-100 text-red-700">overdue</span>
                    : `due ${fmtDateFull(p.due_date)}`
                  : "no due date"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-medium">{money(Number(p.amount))}</span>
              {canEdit && (
                <>
                  <button className="btn-ghost px-1.5" onClick={() => settle(p.id)} title="Mark paid">
                    <Check className="h-4 w-4 text-emerald-700" />
                  </button>
                  <button className="btn-ghost px-1.5" onClick={() => remove(p.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-muted" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-muted">Nothing due.</li>}
      </ul>
    </div>
  );
}
