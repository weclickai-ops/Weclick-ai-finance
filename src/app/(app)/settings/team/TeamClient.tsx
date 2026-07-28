"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import type { FinanceUser, FinanceRole } from "@/lib/types";
import { Check, X } from "lucide-react";

const ROLES: FinanceRole[] = ["owner", "accountant", "member"];
const HELP: Record<FinanceRole, string> = {
  owner: "Everything, including granting access.",
  accountant: "Approves expenses, edits dues and categories.",
  member: "Logs expenses, sees the totals.",
};

export function TeamClient({ team: initial, meId }: { team: FinanceUser[]; meId: string }) {
  const supabase = createClient();
  const [team, setTeam] = useState(initial);
  const [pick, setPick] = useState<Record<string, FinanceRole>>({});

  const waiting = team.filter((u) => !u.active && u.id !== meId);
  const members = team.filter((u) => u.active || u.id === meId);

  async function approve(id: string) {
    const role = pick[id] ?? "member";
    setTeam((t) => t.map((u) => (u.id === id ? { ...u, active: true, role } : u)));
    await supabase.from("finance_users").update({ active: true, role }).eq("id", id);
  }
  async function reject(id: string) {
    setTeam((t) => t.filter((u) => u.id !== id));
    await supabase.from("finance_users").delete().eq("id", id);
  }
  async function setRole(id: string, role: FinanceRole) {
    setTeam((t) => t.map((u) => (u.id === id ? { ...u, role } : u)));
    await supabase.from("finance_users").update({ role }).eq("id", id);
  }
  async function toggle(id: string, active: boolean) {
    setTeam((t) => t.map((u) => (u.id === id ? { ...u, active } : u)));
    await supabase.from("finance_users").update({ active }).eq("id", id);
  }

  return (
    <div className="space-y-5">
      {/* Roles are set in the CRM and mirrored here by a database trigger
          (06-sync-roles-from-crm.sql), so there is one place to manage people. */}
      <div className="rounded-xl2 bg-black/[0.03] px-4 py-3 text-[13px] text-muted">
        Roles come from the CRM. Change someone in{" "}
        <a href="https://crm.weclickai.com/settings/team" target="_blank" rel="noreferrer"
           className="font-medium text-copper hover:underline">CRM · Team &amp; roles</a>{" "}
        and it applies here too — admin becomes owner, manager becomes accountant,
        agent becomes member.
      </div>

      {waiting.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-semibold">Access requests</h2>
            <span className="chip bg-amber-100 text-amber-800">{waiting.length} pending</span>
          </div>
          <ul>
            {waiting.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-sm font-semibold">
                  {initials(u.full_name, u.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{u.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <select className="input w-36 capitalize" value={pick[u.id] ?? "member"}
                        onChange={(e) => setPick({ ...pick, [u.id]: e.target.value as FinanceRole })}>
                  {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
                <button className="btn-outline px-2.5" onClick={() => approve(u.id)}>
                  <Check className="h-4 w-4 text-emerald-700" />
                </button>
                <button className="btn-outline px-2.5" onClick={() => reject(u.id)}>
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-line">
            <th className="th">Member</th><th className="th">Role</th><th className="th">Status</th>
          </tr></thead>
          <tbody>
            {members.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-charcoal text-sm font-semibold text-white">
                      {initials(u.full_name, u.email)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {u.full_name ?? "—"} {u.id === meId && <span className="text-xs text-muted">(you)</span>}
                      </p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="td">
                  <span className="inline-flex items-center gap-2">
                    <span className="chip bg-black/5 capitalize text-ink">{u.role}</span>
                    <a href="https://crm.weclickai.com/settings/team" target="_blank" rel="noreferrer"
                       className="text-xs text-copper hover:underline">change in CRM</a>
                  </span>
                  <p className="mt-1 text-xs text-muted">{HELP[u.role]}</p>
                </td>
                <td className="td">
                  <button onClick={() => toggle(u.id, !u.active)} disabled={u.id === meId}
                          className={`chip ${u.active ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-muted"}`}>
                    {u.active ? "Active" : "Revoked"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
