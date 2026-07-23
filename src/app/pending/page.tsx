import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fu } = await supabase
    .from("finance_users").select("active").eq("id", user.id).maybeSingle();
  if (fu?.active) redirect("/overview");

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[360px] text-center">
        <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-full bg-black/5">
          <Clock className="h-5 w-5 text-muted" />
        </span>
        <h1 className="font-display text-xl font-semibold">Waiting for approval</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Finance access is granted separately from the CRM. An owner needs to approve you
          before you can see the books.
        </p>
        <p className="mt-4 text-xs text-muted">{user.email}</p>
        <div className="mt-6"><SignOutButton /></div>
      </div>
    </div>
  );
}
