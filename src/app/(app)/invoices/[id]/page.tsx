import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDoc } from "./InvoiceDoc";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ]);
  if (!invoice) notFound();
  const { data: payments } = await supabase
    .from("invoice_payments").select("*").eq("invoice_id", id).order("paid_on", { ascending: false });
  const { data: { user } } = await supabase.auth.getUser();

  return <InvoiceDoc invoice={invoice} settings={settings} payments={payments ?? []} meId={user?.id ?? null} />;
}
