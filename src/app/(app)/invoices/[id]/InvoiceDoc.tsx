"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { amount } from "@/lib/currency";
import { money, fmtDateFull } from "@/lib/utils";
import { Printer, Plus, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const METHODS = ["Bank transfer", "UPI", "Wire", "Razorpay", "Cash", "Cheque", "Card", "Other"];

export function InvoiceDoc({ invoice, settings, payments: initial, meId }: {
  invoice: any; settings: any; payments: any[]; meId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [payments, setPayments] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cur = invoice.currency ?? "INR";
  const lines: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const received = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(invoice.total) - received);
  const foreign = Number(invoice.exchange_rate ?? 1) !== 1;

  const [form, setForm] = useState({
    amount: "", paid_on: new Date().toISOString().slice(0, 10),
    method: "Bank transfer", reference: "",
  });

  async function record(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setSaving(true); setError(null);
    const { data, error: err } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id, amount: amt, paid_on: form.paid_on,
      method: form.method, reference: form.reference, recorded_by: meId,
    }).select().single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    setPayments([data, ...payments]);
    setForm({ ...form, amount: "", reference: "" });
    setOpen(false);
    router.refresh();
  }

  async function issue() {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", invoice.id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* toolbar — hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/invoices" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> All invoices</Link>
        <div className="flex gap-2">
          {invoice.status === "draft" && <button className="btn-outline" onClick={issue}>Mark as sent</button>}
          {balance > 0 && (
            <button className="btn-primary" onClick={() => setOpen(!open)}>
              <Plus className="h-4 w-4" /> Record payment
            </button>
          )}
          <button className="btn-outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={record} className="card space-y-3 p-5 print:hidden">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Amount ({cur})</label>
              <input className="input" type="number" step="0.01" value={form.amount}
                     placeholder={String(balance)} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Received on</label>
              <input className="input" type="date" value={form.paid_on}
                     onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reference / UTR</label>
              <input className="input" value={form.reference}
                     onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save payment
            </button>
          </div>
        </form>
      )}

      {/* the document */}
      <div className="mx-auto max-w-[820px] rounded-xl2 border border-line bg-white p-10 sm:p-12 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings?.logo_url ?? "/logo.png"} alt={settings?.legal_name ?? "WeClick AI"} className="h-8 w-auto" />
            {settings?.tagline && <p className="mt-2 text-xs text-muted">{settings.tagline}</p>}
            <div className="mt-3 text-xs leading-relaxed text-muted">
              {settings?.address && <>{settings.address}<br /></>}
              {settings?.gstin && <>GSTIN: {settings.gstin}<br /></>}
              {settings?.pan && <>PAN: {settings.pan}<br /></>}
              {settings?.email}{settings?.phone ? ` · ${settings.phone}` : ""}
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.08em] text-copper">Invoice</h1>
            <div className="mt-3 text-xs leading-loose text-muted">
              <div className="font-semibold text-ink">{invoice.number}</div>
              <div>Issued {fmtDateFull(invoice.issued_on ?? invoice.created_at)}</div>
              {invoice.due_date && <div>Due {fmtDateFull(invoice.due_date)}</div>}
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Bill to</p>
            <p className="mt-1.5 font-semibold">{invoice.client_name}</p>
            <div className="mt-1 text-xs leading-relaxed text-muted">
              {invoice.client_address && <>{invoice.client_address}<br /></>}
              {invoice.client_email}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">
              {balance > 0 ? "Amount due" : "Total"}
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {amount(balance > 0 ? balance : Number(invoice.total), cur)}
            </p>
            {foreign && (
              <p className="mt-1 text-xs text-muted">
                {cur} · ≈ {money(Number(invoice.total) * Number(invoice.exchange_rate))} at {invoice.exchange_rate}
              </p>
            )}
          </div>
        </div>

        <table className="mt-8 w-full">
          <thead>
            <tr className="bg-black/[0.04]">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">Description</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">Qty</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">Rate</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="px-3 py-3 text-sm">{l.description}</td>
                <td className="px-3 py-3 text-center text-sm">{l.qty}</td>
                <td className="px-3 py-3 text-right text-sm">{amount(Number(l.rate), cur)}</td>
                <td className="px-3 py-3 text-right text-sm">{amount(Number(l.qty) * Number(l.rate), cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <div className="w-[280px]">
            <div className="flex justify-between py-1 text-sm"><span className="text-muted">Subtotal</span><span>{amount(Number(invoice.subtotal), cur)}</span></div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted">
                GST {invoice.tax_percent}%{Number(invoice.tax_percent) === 0 ? " (zero rated)" : ""}
              </span>
              <span>{amount(Number(invoice.total) - Number(invoice.subtotal), cur)}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t-2 border-ink pt-2 font-display font-bold">
              <span>Total</span><span>{amount(Number(invoice.total), cur)}</span>
            </div>
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between py-1 text-xs text-muted">
                <span>Paid {fmtDateFull(p.paid_on)} · {p.method}</span>
                <span>−{amount(Number(p.amount), cur)}</span>
              </div>
            ))}
            {payments.length > 0 && (
              <div className="flex justify-between border-t border-line pt-1.5 text-sm font-semibold">
                <span>Balance due</span><span>{amount(balance, cur)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-black/[0.015] p-4">
          <p className="text-xs font-semibold">Payment details</p>
          <div className="mt-2 grid gap-4 text-xs leading-relaxed text-muted sm:grid-cols-2">
            <div>
              {settings?.account_name && <>Account name: {settings.account_name}<br /></>}
              {settings?.bank_name && <>Bank: {settings.bank_name}<br /></>}
              {settings?.account_number && <>Account: {settings.account_number}</>}
            </div>
            <div>
              {settings?.ifsc && <>IFSC: {settings.ifsc}<br /></>}
              {settings?.swift && <>SWIFT: {settings.swift}<br /></>}
              {settings?.upi && <>UPI: {settings.upi}</>}
            </div>
          </div>
        </div>

        {settings?.default_terms && (
          <div className="mt-6">
            <p className="text-xs font-semibold">Terms &amp; conditions</p>
            <div className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted">
              {settings.default_terms}
            </div>
          </div>
        )}

        {invoice.notes && <p className="mt-5 text-xs text-muted">{invoice.notes}</p>}

        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">Thank you for your business.</p>
      </div>
    </div>
  );
}
