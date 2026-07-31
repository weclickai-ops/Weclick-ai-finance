"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { money, cx, fmtDate } from "@/lib/utils";
import {
  Search, X, SlidersHorizontal, ArrowDownLeft, ArrowUpRight,
  ArrowLeftRight, Landmark, Download, ExternalLink, Receipt, FileText,
  Pencil, Trash2, Loader2, Check,
} from "lucide-react";
import type { FinanceUser } from "@/lib/types";

export type Txn = {
  id: string;
  kind: "income" | "expense" | "gst" | "transfer_in" | "transfer_out";
  amount: number;
  txn_date: string;
  category: string;
  party: string;
  description: string;
  reference: string | null;
  status: string;
  bank_account_id: string | null;
  invoice_id: string | null;
  gst_amount: number;
  receipt_url: string | null;
  actor: string | null;
  created_at: string;
  source: string;
};

const KIND: Record<Txn["kind"], { label: string; icon: any; cls: string; sign: string }> = {
  income:       { label: "Income",   icon: ArrowDownLeft,   cls: "text-emerald-700", sign: "+" },
  expense:      { label: "Expense",  icon: ArrowUpRight,    cls: "text-red-600",     sign: "−" },
  gst:          { label: "GST held", icon: Landmark,        cls: "text-violet-700",  sign: "·" },
  transfer_in:  { label: "Transfer in",  icon: ArrowLeftRight, cls: "text-muted",   sign: "+" },
  transfer_out: { label: "Transfer out", icon: ArrowLeftRight, cls: "text-muted",   sign: "−" },
};

const PAGE = 25;

export function TransactionsClient({
  txns,
  banks,
  categories,
  people,
  me,
}: {
  txns: Txn[];
  banks: { id: string; label: string }[];
  categories: string[];
  people: Record<string, string>;
  me: FinanceUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [bank, setBank] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ by: "txn_date" | "amount"; dir: "asc" | "desc" }>({
    by: "txn_date", dir: "desc",
  });
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    amount: "", txn_date: "", category: "", party: "", description: "",
    bank_account_id: "", reference: "",
  });

  const canApprove = me?.role === "owner" || me?.role === "accountant";
  const isOwner = me?.role === "owner";

  /** Who may change what. Entries you logged yourself stay yours while pending. */
  function canEdit(t: Txn) {
    if (t.source === "entry") return canApprove || (t.actor === me?.id && t.status === "pending");
    return canApprove;
  }
  function canDelete(t: Txn) {
    if (t.source === "entry") return isOwner || (t.actor === me?.id && t.status === "pending");
    return canApprove;
  }

  function startEdit(t: Txn) {
    setDraft({
      amount: String(t.amount),
      txn_date: t.txn_date,
      category: t.category,
      party: t.party,
      description: t.description,
      bank_account_id: t.bank_account_id ?? "",
      reference: t.reference ?? "",
    });
    setErr(null);
    setEditing(true);
  }

  async function saveEdit(t: Txn) {
    const amt = Number(draft.amount);
    if (!amt || amt <= 0) { setErr("Enter an amount."); return; }
    setSaving(true); setErr(null);

    let error = null;
    if (t.source === "entry") {
      ({ error } = await supabase.from("finance_entries").update({
        amount: amt,
        entry_date: draft.txn_date,
        category: draft.category,
        client_name: draft.party || null,
        note: draft.description || null,
        bank_account_id: draft.bank_account_id || null,
      }).eq("id", t.id));
    } else if (t.source === "invoice_payment") {
      // The invoice trigger recalculates amount_paid and status from this.
      ({ error } = await supabase.from("invoice_payments").update({
        amount: amt,
        paid_on: draft.txn_date,
        reference: draft.reference || null,
        bank_account_id: draft.bank_account_id || null,
      }).eq("id", t.id));
    } else {
      ({ error } = await supabase.from("bank_transfers").update({
        amount: amt,
        moved_on: draft.txn_date,
        reference: draft.reference || null,
        note: draft.description || null,
      }).eq("id", t.id));
    }

    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    setOpenId(null);
    router.refresh();
  }

  async function remove(t: Txn) {
    setSaving(true); setErr(null);
    const table =
      t.source === "entry" ? "finance_entries"
      : t.source === "invoice_payment" ? "invoice_payments"
      : "bank_transfers";
    const { error } = await supabase.from(table).delete().eq("id", t.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setConfirming(false);
    setOpenId(null);
    router.refresh();
  }

  /** Receipts live in a private bucket — mint a short-lived link to view one. */
  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (error || !data) return;
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const bankName = useMemo(
    () => new Map(banks.map((b) => [b.id, b.label])),
    [banks]
  );

  const rows = useMemo(() => {
    let out = txns;
    if (kind) out = out.filter((t) => t.kind === kind);
    if (bank) out = out.filter((t) => t.bank_account_id === bank);
    if (cat) out = out.filter((t) => t.category === cat);
    if (status) out = out.filter((t) => t.status === status);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter((t) =>
        [t.party, t.description, t.category, t.reference].some((v) => v?.toLowerCase().includes(s))
      );
    }
    return [...out].sort((a, b) => {
      const av = sort.by === "amount" ? Number(a.amount) : a.txn_date;
      const bv = sort.by === "amount" ? Number(b.amount) : b.txn_date;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [txns, kind, bank, cat, status, q, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const open = openId ? rows.find((t) => t.id === openId && true) ?? null : null;

  const totals = useMemo(() => {
    const inc = rows.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = rows.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { inc, exp, net: inc - exp };
  }, [rows]);

  const dirty = Boolean(kind || bank || cat || status || q);

  function exportCsv() {
    const head = ["Date", "Type", "Category", "Party", "Description", "Bank", "Status", "Amount"];
    const lines = rows.map((t) => [
      t.txn_date, KIND[t.kind].label, t.category, t.party,
      t.description.replace(/"/g, "'"), bankName.get(t.bank_account_id ?? "") ?? "", t.status,
      String(t.amount),
    ]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Drop = ({
    value, onChange, options,
  }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <select
      className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none hover:border-copper/40 focus:border-copper"
      value={value}
      onChange={(e) => { onChange(e.target.value); setPage(0); }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <>
      {/* summary of what's on screen, not of everything */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { k: "In", v: totals.inc, cls: "text-emerald-700" },
          { k: "Out", v: totals.exp, cls: "text-red-600" },
          { k: "Net", v: totals.net, cls: totals.net >= 0 ? "text-ink" : "text-red-600" },
        ].map((x) => (
          <div key={x.k} className="card p-4">
            <p className="text-[12px] text-muted">{x.k}{dirty && " (filtered)"}</p>
            <p className={cx("mt-1 font-display text-[22px] font-semibold tabular-nums", x.cls)}>
              {money(x.v)}
            </p>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input h-10 pl-9"
            placeholder="Search party, note, reference…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          {q && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink" onClick={() => setQ("")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          className={cx("inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px]",
                        showFilters || dirty ? "border-copper/50 bg-copper-soft text-copper" : "border-line bg-surface hover:bg-black/[0.02]")}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </button>
        <button className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] hover:bg-black/[0.02]" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {showFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-black/[0.012] p-2.5">
          <Drop value={kind} onChange={setKind} options={[
            { value: "", label: "All types" },
            ...Object.entries(KIND).map(([v, m]) => ({ value: v, label: m.label })),
          ]} />
          <Drop value={bank} onChange={setBank} options={[
            { value: "", label: "All accounts" },
            ...banks.map((b) => ({ value: b.id, label: b.label })),
          ]} />
          <Drop value={cat} onChange={setCat} options={[
            { value: "", label: "All categories" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]} />
          <Drop value={status} onChange={setStatus} options={[
            { value: "", label: "Any status" },
            { value: "approved", label: "Approved" },
            { value: "pending", label: "Pending" },
            { value: "rejected", label: "Rejected" },
          ]} />
          {dirty && (
            <button className="inline-flex h-9 items-center gap-1.5 px-2 text-[13px] text-muted hover:text-ink"
                    onClick={() => { setQ(""); setKind(""); setBank(""); setCat(""); setStatus(""); setPage(0); }}>
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-medium">Nothing here</p>
            <p className="mt-1 text-sm text-muted">
              {dirty ? "No transactions match those filters." : "Record a payment or log an expense to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-line">
                  <th className="th cursor-pointer select-none"
                      onClick={() => setSort({ by: "txn_date", dir: sort.by === "txn_date" && sort.dir === "desc" ? "asc" : "desc" })}>
                    Date {sort.by === "txn_date" && (sort.dir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="th">Type</th>
                  <th className="th">Party</th>
                  <th className="th">Category</th>
                  <th className="th">Account</th>
                  <th className="th">Status</th>
                  <th className="th cursor-pointer select-none text-right"
                      onClick={() => setSort({ by: "amount", dir: sort.by === "amount" && sort.dir === "desc" ? "asc" : "desc" })}>
                    Amount {sort.by === "amount" && (sort.dir === "desc" ? "↓" : "↑")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.map((t) => {
                  const k = KIND[t.kind];
                  return (
                    <tr key={`${t.source}-${t.id}-${t.kind}`}
                        onClick={() => setOpenId(t.id)}
                        className={cx("cursor-pointer border-b border-line last:border-0 hover:bg-black/[0.015]",
                                      openId === t.id && "bg-copper/[0.04]")}>
                      <td className="td whitespace-nowrap text-[13px]">{fmtDate(t.txn_date)}</td>
                      <td className="td">
                        <span className={cx("inline-flex items-center gap-1.5 text-[12px]", k.cls)}>
                          <k.icon className="h-3.5 w-3.5" /> {k.label}
                        </span>
                      </td>
                      <td className="td">
                        <span className="block max-w-[14rem] truncate text-[13px]">{t.party || "—"}</span>
                        {t.description && (
                          <span className="block max-w-[14rem] truncate text-[11px] text-muted">{t.description}</span>
                        )}
                      </td>
                      <td className="td text-[13px] text-muted">{t.category}</td>
                      <td className="td text-[12px] text-muted">
                        {bankName.get(t.bank_account_id ?? "") ?? "—"}
                      </td>
                      <td className="td">
                        <span className={cx("chip text-[11px]",
                          t.status === "approved" ? "bg-emerald-50 text-emerald-700"
                          : t.status === "pending" ? "bg-amber-50 text-amber-800"
                          : "bg-black/[0.05] text-muted")}>
                          {t.status}
                        </span>
                      </td>
                      <td className={cx("td text-right font-medium tabular-nums", k.cls)}>
                        {k.sign}{money(Number(t.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="text-muted">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1.5">
            <button className="btn-outline px-2.5 py-1.5 text-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn-outline px-2.5 py-1.5 text-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20" onClick={() => { setOpenId(null); setEditing(false); setConfirming(false); }} />
          <div className="absolute right-0 top-0 h-full w-[400px] max-w-[92vw] overflow-y-auto border-l border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className={cx("inline-flex items-center gap-1.5 text-[12px]", KIND[open.kind].cls)}>
                  {KIND[open.kind].label}
                </span>
                <p className={cx("mt-1 font-display text-[30px] font-semibold leading-none tabular-nums", KIND[open.kind].cls)}>
                  {KIND[open.kind].sign}{money(Number(open.amount))}
                </p>
              </div>
              <button className="btn-ghost px-2 py-1" onClick={() => setOpenId(null)}>
                <X className="h-4 w-4 text-muted" />
              </button>
            </div>

            {err && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</p>
            )}

            {editing ? (
              <div className="mt-6 space-y-3">
                <div>
                  <label className="label">Amount</label>
                  <input className="input" inputMode="decimal" value={draft.amount}
                         onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={draft.txn_date}
                         onChange={(e) => setDraft({ ...draft, txn_date: e.target.value })} />
                </div>
                {open.source === "entry" && (
                  <>
                    <div>
                      <label className="label">Category</label>
                      <select className="input" value={draft.category}
                              onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                        {[draft.category, ...categories.filter((c) => c !== draft.category)]
                          .map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Party</label>
                      <input className="input" value={draft.party}
                             onChange={(e) => setDraft({ ...draft, party: e.target.value })} />
                    </div>
                  </>
                )}
                {open.source !== "entry" && (
                  <div>
                    <label className="label">Reference</label>
                    <input className="input" value={draft.reference}
                           onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={draft.description}
                         onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
                {open.source !== "transfer" && (
                  <div>
                    <label className="label">Bank account</label>
                    <select className="input" value={draft.bank_account_id}
                            onChange={(e) => setDraft({ ...draft, bank_account_id: e.target.value })}>
                      <option value="">Not specified</option>
                      {banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                )}

                {open.source === "invoice_payment" && (
                  <p className="text-[11px] leading-relaxed text-muted">
                    Changing this updates the invoice&rsquo;s paid amount and status automatically.
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button className="btn-primary flex-1 justify-center" onClick={() => saveEdit(open)} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save changes
                  </button>
                  <button className="btn-ghost text-muted" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
            <dl className="mt-6 space-y-3 text-[13px]">
              {[
                ["Date", fmtDate(open.txn_date)],
                ["Category", open.category],
                ["Party", open.party || "—"],
                ["Description", open.description || "—"],
                ["Reference", open.reference || "—"],
                ["Bank account", bankName.get(open.bank_account_id ?? "") ?? "—"],
                ["GST", open.gst_amount ? money(Number(open.gst_amount)) : "—"],
                ["Status", open.status],
                ["Logged by", people[open.actor ?? ""] ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line pb-2.5 last:border-0">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            )}

            {!editing && (
              <div className="mt-6 flex gap-2">
                {canEdit(open) && (
                  <button className="btn-outline flex-1 justify-center text-sm" onClick={() => startEdit(open)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {canDelete(open) && (
                  confirming ? (
                    <div className="flex flex-1 gap-2">
                      <button className="btn-danger flex-1 justify-center text-sm" onClick={() => remove(open)} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete for good
                      </button>
                      <button className="btn-ghost text-sm text-muted" onClick={() => setConfirming(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="btn-ghost px-3 text-sm text-muted hover:text-red-600"
                            onClick={() => setConfirming(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )
                )}
              </div>
            )}

            {!editing && !canEdit(open) && (
              <p className="mt-4 text-[11px] leading-relaxed text-muted">
                Approved entries can only be changed by an owner or accountant.
              </p>
            )}

            <div className="mt-6 space-y-2">
              {open.invoice_id && (
                <Link href={`/invoices/${open.invoice_id}`} className="btn-outline w-full justify-center text-sm">
                  <FileText className="h-4 w-4" /> Open invoice
                </Link>
              )}
              {open.receipt_url && (
                <button onClick={() => openReceipt(open.receipt_url!)}
                        className="btn-outline w-full justify-center text-sm">
                  <ExternalLink className="h-4 w-4" /> View receipt
                </button>
              )}
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-muted">
              {open.source === "invoice_payment"
                ? "Recorded against an invoice — edit it from the invoice itself so the balance stays correct."
                : open.source === "transfer"
                ? "Both sides of a transfer between your own accounts. Never counted as income or expense."
                : "Logged by hand under Transactions."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
