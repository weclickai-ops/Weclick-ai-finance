"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { GoogleButton } from "./GoogleButton";

/**
 * useSearchParams needs a Suspense boundary or Next can't prerender the page.
 * The wrapper below provides one; this is the actual form.
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // /auth/callback bounces failures back here with a readable message.
  useEffect(() => {
    const e = params.get("error");
    if (e) setError(e);
  }, [params]);

  /** Emails a one-time link that lands on /auth/reset. */
  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Through the callback so the code becomes a session before they land.
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            // Without this, Supabase sends everyone to the project's Site URL,
            // which can only be one app. CRM and Finance share one auth project,
            // so Finance signups were landing on the CRM. Using the origin the
            // person actually signed up on keeps each app sending people back to
            // itself, and stops it depending on a dashboard setting.
            emailRedirectTo: `${window.location.origin}/pending`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice("Account created. Check your email for the confirmation link.");
          setMode("signin");
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left — brand panel */}
      <div className="relative hidden flex-col justify-between p-12 lg:flex"
           style={{ background: "var(--charcoal)" }}>
        <Logo light />
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-white">
            Find businesses that <span className="text-copper">don&apos;t have a website</span> yet.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Run a niche campaign anywhere in the world by postal code. WeClick AI CRM
            surfaces the leads, tracks the pipeline, and gets you to &quot;paid&quot;.
          </p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} WeClick AI</p>
      </div>

      {/* right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Sign in"
              : mode === "signup" ? "Create your account"
              : "Reset your password"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin"
              ? "Welcome back — pick up where you left off."
              : mode === "signup"
              ? "Company email gets you straight in. Everyone else waits for an admin to approve."
              : "We'll email you a link to set a new one."}
          </p>

          {mode !== "forgot" && (
            <>
              <div className="mt-6">
                <GoogleButton
                  label={mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
                  onError={setError}
                />
              </div>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted">or use your email</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          {mode === "forgot" ? (
            sent ? (
              <div className="mt-6">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100">
                  <MailCheck className="h-5 w-5 text-emerald-700" />
                </div>
                <p className="mt-3 font-medium">Check your inbox</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  If an account exists for {email}, a reset link is on its way.
                  It lasts an hour and works once.
                </p>
                <button
                  className="btn-ghost mt-5 px-0 text-sm text-copper"
                  onClick={() => { setMode("signin"); setSent(false); }}
                >
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={sendReset} className="mt-6 space-y-4">
                <div>
                  <label className="label">Work email</label>
                  <input className="input" type="email" value={email} autoFocus
                         onChange={(e) => setEmail(e.target.value)}
                         placeholder="you@weclickai.com" required />
                </div>

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Email me a link
                </button>
                <button type="button"
                        className="btn-ghost w-full justify-center text-sm text-muted"
                        onClick={() => { setMode("signin"); setError(null); }}>
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
              </form>
            )
          ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Full name</label>
                <input className="input" value={fullName}
                       onChange={(e) => setFullName(e.target.value)} placeholder="Teja" required />
              </div>
            )}
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@weclickai.com" required />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label">Password</label>
                {mode === "signin" && (
                  <button type="button"
                          className="text-xs font-medium text-copper hover:underline"
                          onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <input className="input" type="password" value={password}
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          )}

          {mode !== "forgot" && (
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-copper hover:underline"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
