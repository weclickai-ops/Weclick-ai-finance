"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, amount } from "@/lib/currency";
import { money } from "@/lib/utils";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface Line { description: string; qty: number; rate: number }

export function NewInvoiceClient({ settings }: { settings: any }) {
  const router = useRouter();
  const supabase = createClient();
  const base = settings?.base_currency ?? "INR";

  const [f, setF] = useState({
    client_name: "", client_email: "", client_address: "",
    currency: base, exchange_rate: 1, tax_percent: 18,
    issued_on: new Date().toISOString().slice(0, 10),
    due_date: "", notes: "",
  });
  const [lines, setLines] = useState<Line[]>([{ description: "", qty: 1, rate: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foreign = f.currency !== base;
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const tax = subtotal * (Number(f.tax_percent) || 0) / 100;
  const total = subtotal + tax;
  const baseTotal = total * (Number(f.exchange_rate) || 1);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save(preview: boolean) {
    if (!f.client_name.trim()) { setError("Client name is required."); return; }
    if (subtotal <= 0) { setError("Add at least one line item with a rate."); return; }
    setSaving(true); setError(null);
    try {
      const { data: num, error: nErr } = await supabase.rpc("next_invoice_number");
      if (nErr) throw nErr;
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.from("invoices").insert({
        number: num,
        client_name: f.client_name, client_email: f.client_email, client_address: f.client_address,
        currency: f.currency, exchange_rate: foreign ? Number(f.exchange_rate) : 1,
        line_items: lines, subtotal, tax_percent: Number(f.tax_percent), total,
        status: "draft", source: "finance",
        issued_on: f.issued_on, due_date: f.due_date || null, notes: f.notes,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      router.push(preview ? `/invoices/${data.id}` : "/invoices");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the invoice.");
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Client name</label>
          <input className="input" value={f.client_name} placeholder="Nordic Design Co"
                 onChange={(e) => setF({ ...f, client_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" value={f.currency}
                  onChange={(e) => setF({ ...f, currency: e.target.value, exchange_rate: e.target.value === base ? 1 : f.exchange_rate })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Client email</label>
          <input className="input" type="email" value={f.client_email}
                 onChange={(e) => setF({ ...f, client_email: e.target.value })} />
        </div>
        <div>
          <label className="label">Issued on</label>
          <input className="input" type="date" value={f.issued_on}
                 onChange={(e) => setF({ ...f, issued_on: e.target.value })} />
        </div>
        <div>
          <label className="label">Due date</label>
          <input className="input" type="date" value={f.due_date}
                 onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label">Client address</label>
        <input className="input" value={f.client_address} placeholder="Storgata 14, 0155 Oslo, Norway"
               onChange={(e) => setF({ ...f, client_address: e.target.value })} />
      </div>

      {foreign && (
        <div className="rounded-lg bg-copper-soft p-4">
          <label className="label">Exchange rate — 1 {f.currency} to {base}</label>
          <input className="input max-w-[200px]" type="number" step="0.0001" value={f.exchange_rate}
                 onChange={(e) => setF({ ...f, exchange_rate: Number(e.target.value) })} />
          <p className="mt-2 text-xs text-[#8A3A05]">
            Locked to this invoice forever, so your books never shift when rates move.
          </p>
        </div>
      )}

      {/* line items */}
      <div>
        <label className="label">Line items</label>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_110px_110px_36px] gap-2">
              <input className="input" placeholder="Website design & build" value={l.description}
                     onChange={(e) => setLine(i, { description: e.target.value })} />
              <input className="input" type="number" min="0" value={l.qty}
                     onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
              <input className="input" type="number" min="0" step="0.01" value={l.rate}
                     onChange={(e) => setLine(i, { rate: Number(e.target.value) })} />
              <input className="input bg-black/[0.03]" disabled value={amount(l.qty * l.rate, f.currency)} />
              <button className="btn-outline px-2" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4 text-muted" />
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost mt-2 text-copper"
                onClick={() => setLines([...lines, { description: "", qty: 1, rate: 0 }])}>
          <Plus className="h-4 w-4" /> Add line
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">GST / tax %</label>
          <input className="input max-w-[140px]" type="number" step="0.01" value={f.tax_percent}
                 onChange={(e) => setF({ ...f, tax_percent: Number(e.target.value) })} />
          <p className="mt-1.5 text-xs text-muted">
            Set 0 for exports if you invoice under an LUT. You control this per invoice.
          </p>
        </div>
        <div className="text-right">
          <div className="flex justify-between text-sm"><span className="text-muted">Subtotal</span><span>{amount(subtotal, f.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Tax {f.tax_percent}%</span><span>{amount(tax, f.currency)}</span></div>
          <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-display text-lg font-semibold">
            <span>Total</span><span>{amount(total, f.currency)}</span>
          </div>
          {foreign && <p className="mt-1 text-xs text-muted">≈ {money(baseTotal)} at {f.exchange_rate}</p>}
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <input className="input" value={f.notes} placeholder="Thanks for the project!"
               onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-outline" disabled={saving} onClick={() => save(false)}>Save draft</button>
        <button className="btn-primary" disabled={saving} onClick={() => save(true)}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save &amp; preview
        </button>
      </div>
    </div>
  );
}
