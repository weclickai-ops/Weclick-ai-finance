import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { RecurringClient } from "./RecurringClient";
import type { FinanceCategory, RecurringItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Rent, EMIs, SaaS renewals, retainers — money you know is coming but that
 * hasn't moved yet.
 *
 * These are NOT posted into the books automatically. A commitment is a
 * forecast; posting it before the money moves would make the P&L claim
 * something that hasn't happened. You confirm each one when it's actually
 * paid, which writes a real entry and rolls the date forward.
 */
export default async function RecurringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: me }, { data: items }, { data: cats }] = await Promise.all([
    supabase.from("finance_users").select("id, role").eq("id", user.id).maybeSingle(),
    supabase.from("finance_recurring").select("*").order("next_due"),
    supabase.from("finance_categories").select("*").order("position"),
  ]);

  const canManage = me?.role === "owner" || me?.role === "accountant";

  return (
    <>
      <PageHeader
        title="Recurring"
        subtitle="Rent, EMIs, renewals and retainers — confirmed when they're actually paid"
      />
      <RecurringClient
        items={(items ?? []) as RecurringItem[]}
        categories={(cats ?? []) as FinanceCategory[]}
        canManage={canManage}
      />
    </>
  );
}
