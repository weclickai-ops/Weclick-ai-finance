"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "./Logo";
import { cx, initials } from "@/lib/utils";
import type { FinanceUser } from "@/lib/types";
import {
  LayoutDashboard, IndianRupee, TrendingDown, Wallet, BarChart3,
  FileText, Sparkles, Users, LogOut, Building2, Repeat, Scale, ArrowLeftRight,
  Menu, X,
} from "lucide-react";

/**
 * Seven modules, not eleven. Money in and Money out collapsed into
 * Transactions; Dues and Recurring moved under it as tabs. The old routes
 * still exist and still work — nothing was deleted, just unlisted, so any
 * bookmark or link in an email keeps resolving.
 */
const NAV = [
  { href: "/overview",     label: "Dashboard",    icon: LayoutDashboard },
  { href: "/invoices",     label: "Invoices",     icon: FileText },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/balance",      label: "Bank accounts", icon: Wallet },
  { href: "/reports",      label: "Reports",      icon: BarChart3 },
];
const SETTINGS = [
  { href: "/settings/company",    label: "Company & invoice", icon: Building2 },
  { href: "/settings/categories", label: "Categories",  icon: Sparkles },
  { href: "/settings/team",       label: "Team access", icon: Users, ownerOnly: true },
];

export function Sidebar({ user }: { user: FinanceUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close on navigate — otherwise you tap a link and the menu stays in the way.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Stop the page behind the drawer scrolling under your finger.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={cx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
        {label}
      </Link>
    );
  };

  const panel = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Logo light />
        <button
          className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => <Item key={n.href} {...n} />)}
        <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Settings</p>
        {SETTINGS.filter((s) => !s.ownerOnly || user.role === "owner").map((n) => <Item key={n.href} {...n} />)}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-copper text-sm font-semibold text-white">
            {initials(user.full_name, user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.full_name ?? user.email}</p>
            <p className="truncate text-xs capitalize text-white/40">{user.role}</p>
          </div>
          <button onClick={signOut} title="Sign out"
                  className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* phone and tablet */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 lg:hidden"
        style={{
          background: "var(--charcoal)",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
        }}
      >
        <button
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo light />
        <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-copper text-[12px] font-semibold text-white">
          {initials(user.full_name, user.email)}
        </span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 top-0 flex h-full w-[16rem] max-w-[85vw] flex-col overflow-y-auto shadow-2xl"
            style={{
              background: "var(--charcoal)",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {panel}
          </aside>
        </div>
      )}

      {/* desktop — unchanged */}
      <aside
        className="hidden w-60 shrink-0 flex-col lg:flex"
        style={{ background: "var(--charcoal)" }}
      >
        {panel}
      </aside>
    </>
  );
}
