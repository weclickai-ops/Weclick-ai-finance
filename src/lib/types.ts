"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FinanceCategory } from "@/lib/types";
import { Plus, Trash2, Check, Pencil, X } from "lucide-react";

/** A spread that stays legible as a small chip and a chart bar. */
const SWATCHES = [
  "#C2410C", "#EA580C", "#B45309", "#4D7C0F", "#0F766E",
  "#0369A1", "#1D4ED8", "#4338CA", "#7C3AED", "#BE185D",
  "#9F1239", "#57534E", "#8A8F98",
];

export function CategoriesClient({ initial, canEdit }: {
  initial: FinanceCategory[]; canEdit: boolean;
}) {
  const supabase = createClient();
  const [cats, setCats] = useState(initial);
  const [name, setName] = useState("");
  const [colour, setColour] = useState(SWATCHES[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (cats.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setError(null);
    const { data, error: err } = await supabase.from("finance_categories")
      .insert({ name: n, position: cats.length + 1, color: colour }).select().single();
    if (err) { setError(err.message); return; }
    setCats([...cats, data]);
    setName("");
  }

  async function setColourFor(id: string, color: string) {
    const before = cats;
    setCats((c) => c.map((x) => (x.id === id ? { ...x, color } : x)));
    const { error: err } = await supabase.from("finance_categories").update({ color }).eq("id", id);
    if (err) { setCats(before); setError(err.message); }
  }

  async function rename(id: string) {
    const n = draft.trim();
    setEditing(null);
    if (!n) return;
    const before = cats;
    setCats((c) => c.map((x) => (x.id === id ? { ...x, name: n } : x)));
    const { error: err } = await supabase.from("finance_categories").update({ name: n }).eq("id", id);
    if (err) { setCats(before); setError(err.message); }
  }

  async function remove(id: string, label: string) {
    // Entries store the category as text, so deleting one here leaves old
    // entries with their label intact — nothing in the books is lost.
    if (!confirm(`Delete "${label}"? Past entries keep their label; you just can't pick it again.`)) return;
    const before = cats;
    setCats((c) => c.filter((x) => x.id !== id));
    const { error: err } = await supabase.from("finance_categories").delete().eq("id", id);
    if (err) {
      setCats(before);
      setError(err.message.toLowerCase().includes("row-level security")
        ? "Only an owner can delete a category."
        : err.message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        )}
        <ul className="space-y-2">
          {cats.map((c) => (
            <li key={c.id} className="rounded-lg border border-line px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden
                  />
                  {editing === c.id ? (
                    <input
                      autoFocus
                      className="input py-1 text-sm"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(c.id);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      onBlur={() => rename(c.id)}
                    />
                  ) : (
                    <span className="truncate text-sm">{c.name}</span>
                  )}
                </div>

                {canEdit && editing !== c.id && (
                  <span className="flex shrink-0 gap-1">
                    <button className="btn-ghost px-2" title="Rename"
                            onClick={() => { setEditing(c.id); setDraft(c.name); }}>
                      <Pencil className="h-3.5 w-3.5 text-muted" />
                    </button>
                    <button className="btn-ghost px-2" title="Delete"
                            onClick={() => remove(c.id, c.name)}>
                      <Trash2 className="h-4 w-4 text-muted hover:text-red-600" />
                    </button>
                  </span>
                )}
                {editing === c.id && (
                  <button className="btn-ghost px-2" onClick={() => setEditing(null)} title="Cancel">
                    <X className="h-4 w-4 text-muted" />
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setColourFor(c.id, s)}
                      aria-label={`Use ${s} for ${c.name}`}
                      className="grid h-5 w-5 place-items-center rounded-full ring-offset-1 transition
                                 hover:scale-110 focus:outline-none focus-visible:ring-2"
                      style={{ background: s }}
                    >
                      {c.color.toLowerCase() === s.toLowerCase() && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
          {cats.length === 0 && (
            <li className="py-8 text-center text-sm text-muted">
              No categories yet. Add one on the right.
            </li>
          )}
        </ul>
      </div>

      {canEdit ? (
        <div className="card h-fit p-5">
          <h2 className="font-display text-base font-semibold">Add a category</h2>
          <input className="input mt-3" value={name} placeholder="Legal & compliance"
                 onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && add()} />

          <p className="label mt-4">Colour</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SWATCHES.map((s) => (
              <button
                key={s}
                onClick={() => setColour(s)}
                aria-label={`Pick ${s}`}
                className="grid h-6 w-6 place-items-center rounded-full transition hover:scale-110"
                style={{ background: s }}
              >
                {colour === s && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>

          <button className="btn-primary mt-4 w-full" onClick={add}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      ) : (
        <div className="card h-fit p-5 text-[13px] text-muted">
          Only an owner or accountant can change categories.
        </div>
      )}
    </div>
  );
}
