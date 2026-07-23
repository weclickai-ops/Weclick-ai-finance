import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import type { FinanceUser } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: fu } = await supabase
    .from("finance_users").select("*").eq("id", user.id).maybeSingle();

  // no finance account, or not approved yet — the CRM login does not get you in here
  if (!fu || !fu.active) redirect("/pending");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={fu as FinanceUser} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-7 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
