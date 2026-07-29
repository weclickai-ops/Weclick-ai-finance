"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/currency";
import { Loader2, Check } from "lucide-react";

const F = (k: string, label: string, ph = "") => ({ k, label, ph });
const COMPANY = [
  F("legal_name", "Legal name", "WeClick AI"),
  F("tagline", "Tagline", "Automate. Market. Scale with AI."),
  F("address", "Registered address", "Madhapur, Hyderabad, Telangana 500081"),
  F("gstin", "GSTIN", "36ABCDE1234F1Z5"),
  F("pan", "PAN", "ABCDE1234F"),
  F("email", "Email", "accounts@weclickai.com"),
  F("phone", "Phone", "+91 90000 00000"),
];
const BANK = [
  F("account_name", "Account name", "WeClick AI"),
  F("bank_name", "Bank & branch", "Kotak Mahindra Bank — Hyderabad, Balanagar"),
  F("account_number", "Account number", "4051128089"),
  F("ifsc", "IFSC", "KKBK0007497"),
  F("swift", "SWIFT (for foreign wires)", "KKBKINBB"),
  F("upi", "UPI ID", "weclickai@kotak"),
];

export function CompanyClient({ initial }: { initial: any }) {
  const supabase = createClient();
  const [s, setS] = useState<any>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: any) => { setS({ ...s, [k]: v }); setSaved(false); };

  async function save() {
    setSaving(true); setError(null);
    const { id, updated_at, ...patch } = s;
    const { error } = await supabase.from("company_settings")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Your company</h2>
          <div className="mt-4 space-y-3">
            {COMPANY.map((f) => (
              <div key={f.k}>
                <label className="label">{f.label}</label>
                <input className="input" value={s[f.k] ?? ""} placeholder={f.ph}
                       onChange={(e) => set(f.k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Payment details</h2>
          <p className="mt-0.5 text-xs text-muted">Printed on every invoice so clients can pay you.</p>
          <div className="mt-4 space-y-3">
            {BANK.map((f) => (
              <div key={f.k}>
                <label className="label">{f.label}</label>
                <input className="input" value={s[f.k] ?? ""} placeholder={f.ph}
                       onChange={(e) => set(f.k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Numbering</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Prefix</label>
              <input className="input" value={s.invoice_prefix ?? "WC-"}
                     onChange={(e) => set("invoice_prefix", e.target.value)} />
            </div>
            <div>
              <label className="label">Next number</label>
              <input className="input" type="number" min="1" value={s.next_number ?? 1}
                     onChange={(e) => set("next_number", Number(e.target.value))} />
            </div>
            <p className="text-xs text-muted">
              Next invoice will be <strong className="text-ink">
                {(s.invoice_prefix ?? "WC-")}{new Date().getFullYear()}-
                {String(s.next_number ?? 1).padStart(s.number_padding ?? 3, "0")}
              </strong>. Shared with the CRM, so numbers never clash.
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Base currency</h2>
          <p className="mt-0.5 text-xs text-muted">Everything is converted to this for reports.</p>
          <select className="input mt-4" value={s.base_currency ?? "INR"}
                  onChange={(e) => set("base_currency", e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-base font-semibold">Logo</h2>
          <p className="mt-0.5 text-xs text-muted">Replace <code>/public/logo.png</code> in the repo to change it.</p>
          <div className="mt-4 rounded-lg border border-line p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo_url ?? "/logo.png"} alt="logo" className="h-8 w-auto" />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-base font-semibold">Opening balance</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          What was already in the bank before you started recording here. The
          Bank balance page adds everything since to this figure, so leaving it
          at zero makes that page read low by exactly this amount.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Amount</label>
            <input className="input" inputMode="decimal" placeholder="0"
                   value={s.opening_balance ?? ""}
                   onChange={(e) => set("opening_balance", e.target.value)} />
          </div>
          <div>
            <label className="label">As at</label>
            <input type="date" className="input"
                   value={s.opening_balance_on ?? ""}
                   onChange={(e) => set("opening_balance_on", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-base font-semibold">Terms &amp; conditions</h2>
        <p className="mt-0.5 text-xs text-muted">Printed at the bottom of every invoice.</p>
        <textarea className="input mt-3 min-h-[140px] resize-y" value={s.default_terms ?? ""}
                  onChange={(e) => set("default_terms", e.target.value)} />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Check className="h-4 w-4" /> Saved</span>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}
