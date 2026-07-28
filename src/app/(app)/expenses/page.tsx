import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { PeriodToggle } from "@/components/PeriodToggle";
import { ExpensesClient } from "./ExpensesClient";
import { periodLabel, periodStart, type Period } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = (sp.period === "month" ? "month" : "week") as Period;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: me }, { data: entries }, { data: cats }, { data: team }] = await Promise.all([
    supabase.from("finance_users").select("*").eq("id", user.id).single(),
    // Money out means money out. This page used to select every entry
    // regardless of kind, so cash INCOME was listed under Expenses — visible
    // as "Client delivery · Money in (cash / offline)" in the outgoings list,
    // while the total below it (correctly) ignored them.
    supabase.from("finance_entries").select("*").neq("kind", "income")
      .order("entry_date", { ascending: false }).limit(500),
    supabase.from("finance_categories").select("*").order("position"),
    supabase.from("finance_users").select("id, full_name, email"),
  ]);

  return (
    <>
      <PageHeader title="Money out" subtitle={`Logged by the team, approved by an owner · ${periodLabel(period)}`}
                  action={<PeriodToggle value={period} />} />
      <ExpensesClient
        me={me} entries={entries ?? []} categories={cats ?? []} team={team ?? []}
        fromISO={periodStart(period).toISOString()} period={period}
      />
    </>
  );
}
