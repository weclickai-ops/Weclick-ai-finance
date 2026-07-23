import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { NewInvoiceClient } from "./NewInvoiceClient";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("company_settings").select("*").eq("id", 1).single();
  return (
    <>
      <PageHeader title="New invoice" subtitle="Terms and payment details come from Settings → Company & invoice" />
      <NewInvoiceClient settings={settings} />
    </>
  );
}
