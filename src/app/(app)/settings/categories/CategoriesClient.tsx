"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";

export function CategoriesClient({ initial, canEdit }: {
  initial: { id: string; name: string; position: number }[]; canEdit: boolean;
}) {
  const supabase = createClient();
  const [cats, setCats] = useState(initial);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (cats.some((c) => c.name.toLowerCase() === n.toLowerCase())) { setError("That category already exists."); return; }
    setError(null);
    const { data, error: err } = await supabase.from("finance_categories")
      .insert({ name: n, position: cats.length + 1 }).select().single();
    if (err) { setError(err.message); return; }
    setCats([...cats, data]); setName("");
  }
  async function remove(id: string) {
    setCats((c) => c.filter((x) => x.id !== id));
    await supabase.from("finance_categories").delete().eq("id", id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <ul className="space-y-2">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <span className="text-sm">{c.name}</span>
              {canEdit && (
                <button className="btn-ghost px-2" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-muted" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {canEdit && (
        <div className="card h-fit p-5">
          <h2 className="font-display text-base font-semibold">Add a category</h2>
          <input className="input mt-3" value={name} placeholder="Legal & compliance"
                 onChange={(e) => setName(e.target.value)} />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button className="btn-primary mt-3 w-full" onClick={add}><Plus className="h-4 w-4" /> Add</button>
        </div>
      )}
    </div>
  );
}
