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
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={fu as FinanceUser} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-7 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
