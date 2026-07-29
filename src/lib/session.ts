import { cache } from "react";
import { createClient } from "./supabase/server";
import type { FinanceUser } from "./types";

/**
 * The signed-in user plus their finance_users row, fetched once per request.
 *
 * Before this existed, every navigation paid for the same lookups three times
 * over: middleware called auth.getUser(), the layout called it again, and then
 * the page called it a third time and re-read finance_users on top. Each
 * auth.getUser() is a network round trip to Supabase Auth, so on an Indian
 * connection that was most of the wait before anything rendered.
 *
 * React's cache() dedupes for the lifetime of one server request, so the
 * layout and the page it wraps now share a single call. Nothing is cached
 * between requests, so there's no risk of showing one person another's data.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, me: null as FinanceUser | null };

  const { data: me } = await supabase
    .from("finance_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, me: (me ?? null) as FinanceUser | null };
});

/** The team list barely changes and several pages want it — dedupe it too. */
export const getTeam = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("finance_users").select("id, full_name, email");
  return data ?? [];
});
