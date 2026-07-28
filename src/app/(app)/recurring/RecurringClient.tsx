"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, fmtDate } from "@/lib/utils";
import type { FinanceCategory, FinanceKind, RecurFreq, RecurringItem } from "@/lib/types";
import { Plus, Loader2, Trash2, Check, Pause, Play } from "lucide-react";

const FREQ: { value: RecurFreq; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
];
const METHODS = ["Bank transfer", "UPI", "Card", "Cash", "Cheque", "Other"];

export function RecurringClient({ items: initial, categories, canManage }: {
  items: RecurringItem[]; categories: FinanceCategory[]; canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "", kind: "expense" as FinanceKind, amount: "",
    category: categories[0]?.name ?? "Other", method: "Bank transfer",
    frequency: "monthly" as RecurFreq, next_due: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const colourOf = (name: string) =>
    categories.find((c) => c.name === name)?.color ?? "#8A8F98";

  const today = new Date().toISOString().slice(0, 10);
  const active = items.filter((i) => i.active);
  const monthlyOut = active
    .filter((i) => i.kind === "expense" && i.frequency === "monthly")
    .reduce((s, i) => s + Number(i.amount), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.label.trim()) { setError("Give it a name."); return; }
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setBusy("add"); setError(null);
    const { data, error: err } = await supabase.from("finance_recurring").insert({
      label: form.label.trim(), kind: form.kind, amount: amt,
      category: form.category, method: form.method, frequency: form.frequency,
      next_due: form.next_due, note: form.note.trim() || null,
    }).select().single();
    setBusy(null);
    if (err) { setError(err.message); return; }
    setItems([...items, data].sort((a, b) => (a.next_due < b.next_due ? -1 : 1)));
    setForm({ ...form, label: "", amount: "", note: "" });
    setOpen(false);
  }

  /** Posts a real approved entry and rolls next_due forward, in one transaction. */
  async function confirmPaid(item: RecurringItem) {
    if (!confirm(`Record ${money(Number(item.amount))} for "${item.label}" as paid today?`)) return;
    setBusy(item.id); setError(null);
    const { error: err } = await supabase.rpc("confirm_recurring", { p_id: item.id });
    setBusy(null);
    if (err) { setError(err.message); return; }
    router.refresh();
    setItems((is) => is.map((i) => (i.id === item.id ? { ...i, next_due: rollForward(i) } : i)));
  }

  function rollForward(i: RecurringItem) {
    const d = new Date(i.next_due);
    if (i.frequency === "weekly") d.setDate(d.getDate() + 7);
    if (i.frequency === "monthly") d.setMonth(d.getMonth() + 1);
    if (i.frequency === "quarterly") d.setMonth(d.getMonth() + 3);
    if (i.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }

  async function toggle(item: RecurringItem) {
    const before = items;
    setItems((is) => is.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)));
    const { error: err } = await supabase.from("finance_recurring")
      .update({ active: !item.active }).eq("id", item.id);
    if (err) { setItems(before); setError(err.message); }
  }

  async function remove(item: RecurringItem) {
    if (!confirm(`Delete "${item.label}"? Entries already recorded from it stay in the books.`)) return;
    const before = items;
    setItems((is) => is.filter((i) => i.id !== item.id));
    const { error: err } = await supabase.from("finance_recurring").delete().eq("id", item.id);
    if (err) {
      setItems(before);
      setError(err.message.toLowerCase().includes("row-level security")
        ? "Only an owner can delete a recurring item." : err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[13px] text-muted">Active commitments</p>
          <p className="mt-1 font-display text-xl font-semibold">{active.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Monthly outgoings</p>
          <p className="mt-1 font-display text-xl font-semibold">{money(monthlyOut)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Due or overdue</p>
          <p className="mt-1 font-display text-xl font-semibold text-copper">
            {active.filter((i) => i.next_due <= today).length}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setOpen(!open)}>
            <Plus className="h-4 w-4" /> Add recurring
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {open && canManage && (
        <form onSubmit={add} className="card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">What is it</label>
              <input className="input" value={form.label} placeholder="Office rent · Laptop EMI · Figma renewal"
                     onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input" type="number" min="0" step="0.01" value={form.amount}
                     onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Direction</label>
              <select className="input" value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value as FinanceKind })}>
                <option value="expense">Money out</option>
                <option value="income">Money in</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">How often</label>
              <select className="input" value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurFreq })}>
                {FREQ.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Next due</label>
              <input className="input" type="date" value={form.next_due}
                     onChange={(e) => setForm({ ...form, next_due: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Method</label>
              <select className="input" value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note</label>
              <input className="input" value={form.note}
                     onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy === "add"}>
              {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">What</th><th className="th">Category</th><th className="th">How often</th>
            <th className="th">Next due</th><th className="th text-right">Amount</th><th className="th" />
          </tr></thead>
          <tbody>
            {items.map((i) => {
              const due = i.active && i.next_due <= today;
              return (
                <tr key={i.id} className={`border-b border-line last:border-0 ${i.active ? "" : "opacity-50"}`}>
                  <td className="td font-medium">
                    {i.label}
                    {i.kind === "income" && <span className="chip ml-2 bg-emerald-50 text-emerald-800">in</span>}
                    {!i.active && <span className="chip ml-2 bg-black/5 text-muted">paused</span>}
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colourOf(i.category) }} />
                      <span className="text-muted">{i.category}</span>
                    </span>
                  </td>
                  <td className="td text-muted">
                    {FREQ.find((f) => f.value === i.frequency)?.label}
                  </td>
                  <td className={`td whitespace-nowrap ${due ? "font-medium text-copper" : "text-muted"}`}>
                    {fmtDate(i.next_due)}{due && " · due"}
                  </td>
                  <td className={`td text-right font-medium ${i.kind === "income" ? "text-emerald-700" : ""}`}>
                    {money(Number(i.amount))}
                  </td>
                  <td className="td text-right">
                    {canManage && (
                      <span className="flex justify-end gap-1">
                        {i.active && (
                          <button className="btn-outline px-2 py-1" title="Record as paid"
                                  disabled={busy === i.id} onClick={() => confirmPaid(i)}>
                            {busy === i.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Check className="h-3.5 w-3.5 text-emerald-700" />}
                          </button>
                        )}
                        <button className="btn-ghost px-2" title={i.active ? "Pause" : "Resume"}
                                onClick={() => toggle(i)}>
                          {i.active ? <Pause className="h-3.5 w-3.5 text-muted" />
                                    : <Play className="h-3.5 w-3.5 text-muted" />}
                        </button>
                        <button className="btn-ghost px-2" title="Delete" onClick={() => remove(i)}>
                          <Trash2 className="h-4 w-4 text-muted hover:text-red-600" />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>
                Nothing recurring yet. Add rent, EMIs, or subscription renewals so they stop being a surprise.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
