import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendAccessRequestEmail } from "@/lib/notify";
import { SignOutButton } from "./SignOutButton";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * This page now also CREATES the access request if one doesn't exist.
 *
 * Why: login/page.tsx only called request_finance_access() inside
 * `if (data.session)`. With "Confirm email" switched on in Supabase — which it
 * is — signUp returns a null session, so that branch never ran. No
 * finance_users row was created, no owner email was sent, and nothing appeared
 * in Settings -> Team to approve. The screen said "Request sent" and "Waiting
 * for approval" while there was, in fact, nothing to approve. People waited
 * forever on a queue of zero.
 *
 * Doing it here means it works on every path in: confirm-email on or off, or
 * someone who already had a CRM account signing in for the first time.
 */
export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: fu } = await supabase
    .from("finance_users").select("active, full_name").eq("id", user.id).maybeSingle();

  if (fu?.active) redirect("/overview");

  // No row yet — this is the real "request access" moment.
  if (!fu) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0];

    const { error } = await supabase.rpc("request_finance_access", {
      p_full_name: fullName ?? null,
    });

    if (!error) {
      // First finance user becomes an active owner, so they skip the queue.
      const { data: fresh } = await supabase
        .from("finance_users").select("active").eq("id", user.id).maybeSingle();
      if (fresh?.active) redirect("/overview");

      // Fire and forget — a mail failure must not strand them on an error page.
      void sendAccessRequestEmail(user.email ?? "", fullName);
    } else {
      console.error("request_finance_access failed:", error.message);
    }
  }

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
