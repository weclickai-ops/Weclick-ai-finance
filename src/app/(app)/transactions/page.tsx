import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, getTeam } from "@/lib/session";
import { PageHeader } from "../PageHeader";
import { TransactionsClient, type Txn } from "./TransactionsClient";
import { AddTransaction } from "./AddTransaction";
import type { FinanceUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { user, me } = await getSession();
  if (!user) redirect("/login");

  const [{ data: txns }, { data: banks }, { data: cats }, team] = await Promise.all([
    // The view unions invoice payments, hand-logged entries and transfers.
    supabase.from("transactions").select("*").order("txn_date", { ascending: false }).limit(2000),
    supabase.from("bank_accounts").select("id, label").order("created_at"),
    supabase.from("finance_categories").select("name").order("position"),
    getTeam(),
  ]);

  const people: Record<string, string> = {};
  (team ?? []).forEach((t: any) => { people[t.id] = t.full_name ?? t.email; });

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every movement of money — in, out, and between your own accounts."
        action={
          <AddTransaction
            banks={(banks ?? []) as { id: string; label: string }[]}
            categories={(cats ?? []).map((c: any) => c.name)}
            me={me as FinanceUser | null}
          />
        }
      />
      <TransactionsClient
        txns={(txns ?? []) as Txn[]}
        banks={(banks ?? []) as { id: string; label: string }[]}
        categories={(cats ?? []).map((c: any) => c.name)}
        people={people}
        me={me as FinanceUser | null}
      />
    </>
  );
}
