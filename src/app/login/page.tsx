"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "request">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/overview"); router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.rpc("request_finance_access", { p_full_name: fullName });
          fetch("/api/access-request", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, full_name: fullName }),
          }).catch(() => {});
          router.push("/pending"); router.refresh();
        } else {
          setNotice("Request sent. Confirm your email, sign in, then wait to be approved.");
          setMode("signin");
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[320px]">
        <div className="mb-8 text-center">
          <span className="mb-3.5 inline-grid h-11 w-11 place-items-center rounded-xl font-display text-xl font-bold text-white"
                style={{ background: "var(--copper)" }}>W</span>
          <p className="font-display text-lg font-semibold tracking-tight">
            WeClick<span className="text-copper"> AI</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">Finance</p>
        </div>

        <form onSubmit={submit} className="space-y-2.5">
          {mode === "request" && (
            <input className="input" value={fullName} required placeholder="Full name"
                   onChange={(e) => setFullName(e.target.value)} />
          )}
          <input className="input" type="email" value={email} required placeholder="you@weclickai.com"
                 onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" value={password} required minLength={6} placeholder="Password"
                 onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{notice}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Request access"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          {mode === "signin" ? "No account?" : "Already have access?"}{" "}
          <button className="font-medium text-copper hover:underline"
                  onClick={() => { setMode(mode === "signin" ? "request" : "signin"); setError(null); setNotice(null); }}>
            {mode === "signin" ? "Request access" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
