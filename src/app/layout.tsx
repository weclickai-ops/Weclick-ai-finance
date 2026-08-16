import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";
import type { FinanceUser } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, me: fu } = await getSession();
  if (!user) redirect("/login");

  // no finance account, or not approved yet — the CRM login does not get you in here
  if (!fu || !fu.active) redirect("/pending");

  return (
    // Phones scroll the whole page so the top bar can stick and browser chrome
    // gets out of the way; desktop keeps the fixed sidebar it already had.
    <div className="lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar user={fu as FinanceUser} />
      <main className="flex-1 lg:overflow-y-auto">
        <div
          className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
