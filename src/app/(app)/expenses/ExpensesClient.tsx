"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, fmtDate } from "@/lib/utils";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FinanceEntry, FinanceKind } from "@/lib/types";
import { Plus, Loader2, Trash2, Check, X } from "lucide-react";

const KIND_LABEL: Record<FinanceKind, string> = {
  expense: "Money out (expense)", income: "Money in (cash / offline)", gst_setaside: "GST set aside",
};
const METHODS = ["Cash", "Bank transfer", "UPI", "Card", "Cheque", "Other"];

export function ExpensesClient({ me, entries: initial, categories, team, fromISO, period }: {
  me: any; entries: FinanceEntry[]; categories: { id: string; name: string }[];
  team: { id: string; full_name: string | null; email: string }[]; fromISO: string; period: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "expense" as FinanceKind, amount: "", category: categories[0]?.name ?? "Other",
    method: "Bank transfer", note: "", entry_date: new Date().toISOString().slice(0, 10),
  });

  const canApprove = me?.role === "owner" || me?.role === "accountant";
  const from = new Date(fromISO);
  const shown = entries.filter((e) => new Date(e.entry_date) >= from);
  const total = shown.filter((e) => e.kind === "expense" && e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const nameOf = (id: string | null) =>
    team.find((t) => t.id === id)?.full_name ?? team.find((t) => t.id === id)?.email ?? "—";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setSaving(true); setError(null);
    const status = canApprove ? "approved" : "pending";
    const { data, error: err } = await supabase.from("finance_entries").insert({
      kind: form.kind, amount: amt, category: form.category, method: form.method, note: form.note,
      entry_date: form.entry_date, status, logged_by: me?.id,
      approved_by: canApprove ? me?.id : null,
      approved_at: canApprove ? new Date().toISOString() : null,
    }).select().single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEntries([data, ...entries]);
    setForm({ ...form, amount: "", note: "" });
    setOpen(false);
    router.refresh();
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, status } : e)));
    await supabase.from("finance_entries").update({
      status, approved_by: me?.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    router.refresh();
  }
  async function remove(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id));
    await supabase.from("finance_entries").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(!open)}>
          <Plus className="h-4 w-4" /> Add entry
        </button>
      </div>

      {open && (
        <form onSubmit={add} className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value as FinanceKind })}>
                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input className="input" type="number" min="1" value={form.amount}
                     onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="32000" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.entry_date}
                     onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">How the money moved</label>
              <select className="input" value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" value={form.note} placeholder="July payroll — 3 people"
                   onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              {canApprove ? "Approved automatically — you can approve." : "Goes to an owner for approval."}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold">This {period}</h2>
          <span className="font-display text-base font-semibold">{money(total)}</span>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">Date</th><th className="th">Category</th><th className="th">Note</th>
            <th className="th">Logged by</th><th className="th">Status</th>
            <th className="th text-right">Amount</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="td whitespace-nowrap text-muted">{fmtDate(e.entry_date)}</td>
                <td className="td">
                  {e.category}
                  {e.kind !== "expense" && <span className="ml-2 chip bg-black/5 text-muted">{KIND_LABEL[e.kind]}</span>}
                </td>
                <td className="td text-muted">{e.note || "—"}</td>
                <td className="td text-muted">{nameOf(e.logged_by)}</td>
                <td className="td"><StatusChip status={e.status} /></td>
                <td className="td text-right font-medium">{money(Number(e.amount))}</td>
                <td className="td text-right">
                  {e.status === "pending" && canApprove && (
                    <span className="flex justify-end gap-1.5">
                      <button className="btn-outline px-2 py-1" onClick={() => decide(e.id, "approved")}>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                      </button>
                      <button className="btn-outline px-2 py-1" onClick={() => decide(e.id, "rejected")}>
                        <X className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    </span>
                  )}
                  {e.status === "pending" && !canApprove && e.logged_by === me?.id && (
                    <button className="btn-ghost px-2" onClick={() => remove(e.id)}>
                      <Trash2 className="h-4 w-4 text-muted" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td className="td text-muted" colSpan={7}>Nothing logged this {period}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
