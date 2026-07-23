import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { loadBook, summarise, isOverdue, daysOverdue } from "@/lib/finance";
import { money, fmtDateFull } from "@/lib/utils";
import { PayablesClient } from "./PayablesClient";

export const dynamic = "force-dynamic";

export default async function DuesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("finance_users").select("*").eq("id", user.id).single();
  const book = await loadBook(supabase);
  const s = summarise(book, "month");

  const outstanding = book.invoices
    .filter((i) => !["void", "written_off", "draft"].includes(i.status))
    .map((i) => ({ ...i, balance: Number(i.total) - Number(i.amount_paid) }))
    .filter((i) => i.balance > 0)
    .sort((a, b) => (isOverdue(b as any) ? 1 : 0) - (isOverdue(a as any) ? 1 : 0));

  const canEdit = me?.role === "owner" || me?.role === "accountant";

  return (
    <>
      <PageHeader title="Dues" subtitle="What's coming in, what's going out" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted">Owed to us</p>
          <p className="mt-2 font-display text-2xl font-semibold text-emerald-700">{money(s.owedToUs)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">We owe</p>
          <p className="mt-2 font-display text-2xl font-semibold text-red-600">{money(s.weOwe)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">Net position</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {s.owedToUs - s.weOwe >= 0 ? "+" : ""}{money(s.owedToUs - s.weOwe)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-semibold">Owed to us</h2>
            <span className="text-xs text-muted">from the CRM</span>
          </div>
          <ul className="divide-y divide-line">
            {outstanding.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.number} <span className="font-normal text-muted">· {i.client_name}</span></p>
                  <p className="mt-0.5 text-xs text-muted">
                    {isOverdue(i as any)
                      ? <span className="chip bg-red-100 text-red-700">Overdue {daysOverdue(i as any)}d</span>
                      : i.due_date ? `due ${fmtDateFull(i.due_date)}` : "no due date"}
                    {Number(i.amount_paid) > 0 && ` · ${money(Number(i.amount_paid), i.currency)} received`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium">{money(i.balance, i.currency)}</span>
              </li>
            ))}
            {outstanding.length === 0 && <li className="px-5 py-4 text-sm text-muted">Nothing outstanding.</li>}
          </ul>
        </div>

        <PayablesClient payables={book.payables} canEdit={canEdit} meId={user.id} />
      </div>
    </>
  );
}
