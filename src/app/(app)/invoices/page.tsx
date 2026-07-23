import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { amount } from "@/lib/currency";
import { isOverdue, daysOverdue } from "@/lib/finance";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Raised here or in the CRM — both land in the same book"
        action={<Link href="/invoices/new" className="btn-primary"><Plus className="h-4 w-4" /> New invoice</Link>}
      />
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">Number</th><th className="th">Client</th><th className="th">Raised in</th>
            <th className="th">Status</th><th className="th text-right">Balance</th><th className="th text-right">Total</th>
          </tr></thead>
          <tbody>
            {(invoices ?? []).map((i) => {
              const bal = Number(i.total) - Number(i.amount_paid);
              return (
                <tr key={i.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                  <td className="td">
                    <Link href={`/invoices/${i.id}`} className="font-medium text-copper hover:underline">{i.number}</Link>
                  </td>
                  <td className="td">{i.client_name}</td>
                  <td className="td">
                    <span className={`chip ${i.source === "finance" ? "bg-copper-soft text-copper" : "bg-black/5 text-muted"}`}>
                      {i.source === "finance" ? "Finance" : "CRM"}
                    </span>
                  </td>
                  <td className="td">
                    {isOverdue(i as any)
                      ? <span className="chip bg-red-100 text-red-700">Overdue {daysOverdue(i as any)}d</span>
                      : <StatusChip status={i.status} />}
                  </td>
                  <td className="td text-right">{bal > 0 ? amount(bal, i.currency) : "—"}</td>
                  <td className="td text-right font-medium">{amount(Number(i.total), i.currency)}</td>
                </tr>
              );
            })}
            {(invoices ?? []).length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
