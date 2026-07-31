"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cx, money } from "@/lib/utils";
import type { FinanceUser } from "@/lib/types";
import {
  X, Loader2, Check, Plus, Upload, ArrowDownLeft, ArrowUpRight,
  ArrowLeftRight, Landmark, Paperclip,
} from "lucide-react";

type Bank = { id: string; label: string };

const TYPES = [
  { value: "expense",  label: "Expense",  icon: ArrowUpRight,   hint: "Money leaving the business" },
  { value: "income",   label: "Income",   icon: ArrowDownLeft,  hint: "Cash, walk-ins, anything not invoiced" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, hint: "Between your own accounts" },
  { value: "gst",      label: "GST held", icon: Landmark,       hint: "Set aside for filing, not profit" },
] as const;

type Kind = (typeof TYPES)[number]["value"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddTransaction({
  banks,
  categories,
  me,
}: {
  banks: Bank[];
  categories: string[];
  me: FinanceUser | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("expense");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBank = banks.find((b) => b.label)?.id ?? "";
  const [f, setF] = useState({
    amount: "",
    category: categories[0] ?? "Other",
    bank_account_id: defaultBank,
    to_account: "",
    date: ymd(new Date()),
    party: "",
    description: "",
    gst: "",
    reference: "",
    receipt_url: "",
    receipt_name: "",
  });

  // Owners and accountants post straight to approved; everyone else queues.
  const canApprove = me?.role === "owner" || me?.role === "accountant";

  function reset() {
    setF({
      amount: "", category: categories[0] ?? "Other", bank_account_id: defaultBank,
      to_account: "", date: ymd(new Date()), party: "", description: "",
      gst: "", reference: "", receipt_url: "", receipt_name: "",
    });
    setKind("expense");
    setError(null);
  }

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError("Keep receipts under 5 MB."); return; }
    setUploading(true); setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${new Date().getFullYear()}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    setUploading(false);
    if (upErr) { setError(upErr.message); return; }
    // Store the path, not a URL — the bucket is private, so links are signed
    // on demand when someone actually opens the receipt.
    setF((prev) => ({ ...prev, receipt_url: path, receipt_name: file.name }));
  }

  async function save() {
    const amt = Number(f.amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    if (kind === "transfer") {
      if (!f.bank_account_id || !f.to_account) { setError("Pick both accounts."); return; }
      if (f.bank_account_id === f.to_account) { setError("Those are the same account."); return; }
    }

    setBusy(true); setError(null);
    try {
      if (kind === "transfer") {
        const { error: err } = await supabase.from("bank_transfers").insert({
          from_account: f.bank_account_id,
          to_account: f.to_account,
          amount: amt,
          moved_on: f.date,
          reference: f.reference.trim() || null,
          note: f.description.trim() || null,
          logged_by: me?.id ?? null,
        });
        if (err) throw err;
      } else {
        const status = canApprove ? "approved" : "pending";
        const { error: err } = await supabase.from("finance_entries").insert({
          kind: kind === "gst" ? "gst_setaside" : kind,
          amount: amt,
          category: kind === "gst" ? "GST" : f.category,
          note: f.description.trim() || null,
          client_name: f.party.trim() || null,
          gst_amount: Number(f.gst) || 0,
          entry_date: f.date,
          bank_account_id: f.bank_account_id || null,
          receipt_url: f.receipt_url || null,
          status,
          logged_by: me?.id ?? null,
          approved_by: canApprove ? me?.id ?? null : null,
          approved_at: canApprove ? new Date().toISOString() : null,
        });
        if (err) throw err;
      }

      setBusy(false);
      setOpen(false);
      reset();
      router.refresh();
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not save that.");
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add transaction
      </button>
    );
  }

  const isTransfer = kind === "transfer";
  const isGst = kind === "gst";

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add transaction
      </button>

      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div className="absolute inset-0 bg-black/25" onClick={() => !busy && setOpen(false)} />

        <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold">Add transaction</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {canApprove ? "Posts straight away." : "Goes to an owner for approval."}
              </p>
            </div>
            <button className="btn-ghost px-2 py-1" onClick={() => setOpen(false)} disabled={busy}>
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>

          {/* type */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setKind(t.value)}
                className={cx(
                  "rounded-xl border p-2.5 text-center transition-colors",
                  kind === t.value
                    ? "border-copper bg-copper-soft text-copper"
                    : "border-line hover:border-copper/40"
                )}
              >
                <t.icon className="mx-auto h-4 w-4" />
                <span className="mt-1 block text-[12px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{TYPES.find((t) => t.value === kind)?.hint}</p>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}

          {/* amount */}
          <div className="mt-5">
            <label className="label">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display text-lg text-muted">₹</span>
              <input
                className="input h-14 pl-8 font-display text-2xl tabular-nums"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{isTransfer ? "From account" : "Bank account"}</label>
              <select className="input" value={f.bank_account_id}
                      onChange={(e) => setF({ ...f, bank_account_id: e.target.value })}>
                <option value="">Not specified</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>

            {isTransfer ? (
              <div>
                <label className="label">To account</label>
                <select className="input" value={f.to_account}
                        onChange={(e) => setF({ ...f, to_account: e.target.value })}>
                  <option value="">Choose…</option>
                  {banks.filter((b) => b.id !== f.bank_account_id)
                        .map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Category</label>
                <select className="input" value={isGst ? "GST" : f.category} disabled={isGst}
                        onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {isGst ? <option>GST</option> : categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={f.date}
                     onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>

            {!isTransfer && (
              <div>
                <label className="label">{kind === "income" ? "Client" : "Paid to"}</label>
                <input className="input" placeholder={kind === "income" ? "Rakshita Hospital" : "Vendor or person"}
                       value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} />
              </div>
            )}

            {isTransfer && (
              <div>
                <label className="label">Reference</label>
                <input className="input" placeholder="UTR / txn id" value={f.reference}
                       onChange={(e) => setF({ ...f, reference: e.target.value })} />
              </div>
            )}
          </div>

          <div className="mt-3">
            <label className="label">Description</label>
            <input className="input" placeholder="What was this for?"
                   value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>

          {!isTransfer && !isGst && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">GST portion</label>
                <input className="input" inputMode="decimal" placeholder="0"
                       value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} />
                <p className="mt-1 text-[11px] text-muted">Of the amount above, if any.</p>
              </div>
              <div>
                <label className="label">Receipt</label>
                {f.receipt_url ? (
                  <div className="flex h-[42px] items-center gap-2 rounded-lg border border-line px-3 text-[13px]">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <span className="flex-1 truncate">{f.receipt_name}</span>
                    <button className="text-muted hover:text-ink"
                            onClick={() => setF({ ...f, receipt_url: "", receipt_name: "" })}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button className="btn-outline h-[42px] w-full justify-center text-sm"
                          onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Attach bill
                  </button>
                )}
                <input
                  ref={fileRef} type="file" className="hidden"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">
              {Number(f.amount) > 0 && (
                <>
                  {kind === "expense" || kind === "transfer" ? "−" : "+"}
                  {money(Number(f.amount))}
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost text-muted" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save} disabled={busy || uploading}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
