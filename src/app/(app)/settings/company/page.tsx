import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { CompanyClient } from "./CompanyClient";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("finance_users").select("role").eq("id", user.id).single();
  if (!["owner", "accountant"].includes(me?.role ?? "")) redirect("/overview");
  const { data: s } = await supabase.from("company_settings").select("*").eq("id", 1).single();
  return (
    <>
      <PageHeader title="Company & invoice" subtitle="Everything printed on your invoices" />
      <CompanyClient initial={s} />
    </>
  );
}
