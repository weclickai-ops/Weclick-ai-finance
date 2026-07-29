import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "../PageHeader";
import { money } from "@/lib/utils";
import { Wallet, ArrowDownRight, ArrowUpRight, Landmark, Info, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * What's actually in the bank, as one number.
 *
 * Deliberately not a period view — this is a running total from the opening
 * balance forward, which is the figure you'd compare against a bank statement.
 * Money owed to you and money you owe are shown separately, because neither
 * has moved yet and folding them in would give a number the bank disagrees
 * with.
 */
export default async function BalancePage() {
  const supabase = await createClient();
  const { me } = await getSession();

  const [{ data: settings }, { data: payments }, { data: entries }, { data: invoices }, { data: payables }] =
    await Promise.all([
      supabase.from("company_settings")
        .select("opening_balance, opening_balance_on").eq("id", 1).maybeSingle(),
      supabase.from("invoice_payments").select("amount, paid_on, method"),
      supabase.from("finance_entries").select("amount, kind, status, entry_date"),
      supabase.from("invoices")
        .select("total, amount_paid, status")
        .not("status", "in", "(void,written_off,draft)"),
      supabase.from("payables").select("amount").eq("paid", false),
    ]);

  const opening = Number(settings?.opening_balance ?? 0);
  const openingOn = settings?.opening_balance_on as string | null | undefined;

  const approved = (entries ?? []).filter((e: any) => e.status === "approved");
  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);

  const invoiceMoney = sum(payments ?? [], (p) => Number(p.amount));
  const otherIncome = sum(approved.filter((e: any) => e.kind === "income"), (e) => Number(e.amount));
  const spent = sum(approved.filter((e: any) => e.kind === "expense"), (e) => Number(e.amount));
  const gstHeld = sum(approved.filter((e: any) => e.kind === "gst_setaside"), (e) => Number(e.amount));

  const moneyIn = invoiceMoney + otherIncome;
  const balance = opening + moneyIn - spent;
  const spendable = balance - gstHeld;

  const owedToUs = sum(invoices ?? [], (i) => Math.max(0, Number(i.total) - Number(i.amount_paid)));
  const weOwe = sum(payables ?? [], (p) => Number(p.amount));

  const lastMovement = [
    ...(payments ?? []).map((p: any) => p.paid_on),
    ...approved.map((e: any) => e.entry_date),
  ].sort().pop();

  const lines = [
    { label: "Opening balance", value: opening, tone: "text-muted", note: openingOn ? `as at ${openingOn}` : "not set" },
    { label: "Invoice payments received", value: invoiceMoney, tone: "text-emerald-700", sign: "+" },
    { label: "Other income", value: otherIncome, tone: "text-emerald-700", sign: "+" },
    { label: "Money out", value: spent, tone: "text-red-600", sign: "−" },
  ];

  return (
    <>
      <PageHeader
        title="Bank balance"
        subtitle="Everything recorded, added up. Not a monthly view."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* the number */}
          <div className="card p-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted" />
              <p className="text-sm text-muted">Balance in hand</p>
            </div>
            <p className="mt-2 font-display text-[44px] font-semibold leading-none tabular-nums">
              {money(balance)}
            </p>
            {gstHeld > 0 && (
              <p className="mt-2.5 text-[13px] text-muted">
                {money(spendable)} of that is yours to spend — {money(gstHeld)} is GST set aside.
              </p>
            )}
            {lastMovement && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
                <Clock className="h-3 w-3" /> last movement {lastMovement}
              </p>
            )}
          </div>

          {/* how it adds up */}
          <div className="card p-5">
            <p className="font-display text-base font-semibold">How it adds up</p>
            <div className="mt-4 space-y-2.5">
              {lines.map((l) => (
                <div key={l.label} className="flex items-baseline justify-between border-b border-line pb-2.5 last:border-0">
                  <span className="text-sm">
                    {l.label}
                    {l.note && <span className="ml-2 text-xs text-muted">{l.note}</span>}
                  </span>
                  <span className={`tabular-nums ${l.tone}`}>
                    {l.sign ?? ""}{money(l.value)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium">Balance</span>
                <span className="font-display text-xl font-semibold tabular-nums">{money(balance)}</span>
              </div>
            </div>
          </div>

          {opening === 0 && (
            <div className="card flex gap-3 border-amber-200 bg-amber-50/60 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="text-[13px] leading-relaxed text-amber-900">
                <p className="font-medium">No opening balance set</p>
                <p className="mt-0.5">
                  This figure only counts what&rsquo;s been recorded in this app.
                  Whatever was already in the account before you started will be
                  missing from it. Set it once under{" "}
                  <Link href="/settings/company" className="underline">
                    Company &amp; invoice
                  </Link>
                  {" "}and the number matches your statement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* not in the bank yet */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-[13px] font-medium">Not in the bank yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Neither of these has moved. They&rsquo;re here for context, not
              counted above.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" /> Owed to us
                </div>
                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-emerald-700">
                  {money(owedToUs)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <ArrowUpRight className="h-3.5 w-3.5 text-red-600" /> We owe
                </div>
                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-red-600">
                  {money(weOwe)}
                </p>
              </div>
              <div className="border-t border-line pt-3">
                <p className="text-xs text-muted">If everything settled</p>
                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
                  {money(balance + owedToUs - weOwe)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted" />
              <p className="text-[13px] font-medium">Reconciling</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              This is a book balance — it adds up what&rsquo;s been entered, not
              what the bank says. If it drifts from your statement, something
              was paid or received without being logged.
            </p>
            {me?.role === "owner" && (
              <Link href="/expenses" className="btn-outline mt-3 w-full justify-center text-sm">
                Log what&rsquo;s missing
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
