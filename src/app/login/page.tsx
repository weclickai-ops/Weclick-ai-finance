"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/pending`,
          },
        });
        if (error) throw error;

        // /pending creates the finance_users row. If the address is on the
        // auto-approve list it redirects straight through to /overview, so
        // approved people never see a waiting screen.
        if (data.session) {
          router.push("/pending"); router.refresh();
        } else {
          setNotice("Check your email for the confirmation link, then sign in.");
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
          {mode === "signup" && (
            <input className="input" value={fullName} required placeholder="Full name"
                   onChange={(e) => setFullName(e.target.value)} />
          )}
          <input className="input" type="email" value={email} required placeholder="you@weclickai.com"
                 onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              value={password}
              required
              minLength={6}
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted
                         transition-colors hover:text-ink focus:outline-none
                         focus-visible:ring-2 focus-visible:ring-copper"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{notice}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          {mode === "signin" ? "No account?" : "Already have one?"}{" "}
          <button className="font-medium text-copper hover:underline"
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
