import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("finance_users").select("role").eq("id", user.id).single();
  const { data: cats } = await supabase.from("finance_categories").select("*").order("position");
  const canEdit = me?.role === "owner" || me?.role === "accountant";
  return (
    <>
      <PageHeader title="Categories" subtitle="How expenses get grouped in reports" />
      <CategoriesClient initial={cats ?? []} canEdit={canEdit} />
    </>
  );
}
