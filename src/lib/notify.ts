/**
 * Emails the owner that someone is waiting for finance access.
 * Server-only. No-ops quietly if Resend isn't configured, so a missing env var
 * can never block a signup.
 */
export async function sendAccessRequestEmail(email: string, fullName?: string | null) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!key || !to) return { ok: true, skipped: true };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.weclickai.com";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "WeClick AI Finance <onboarding@resend.dev>",
        to: [to],
        subject: `Finance access request — ${fullName || email}`,
        html: `
          <div style="font-family:system-ui,sans-serif;font-size:15px;color:#141418">
            <p><strong>${fullName || "Someone"}</strong> asked for access to WeClick AI Finance.</p>
            <p style="color:#6B7280">Email: ${email}</p>
            <p>They cannot see any figures until you approve them.</p>
            <p><a href="${appUrl}/settings/team"
                  style="background:#FF6200;color:#fff;padding:10px 16px;border-radius:8px;
                         text-decoration:none;display:inline-block">Review the request</a></p>
          </div>`,
      }),
    });
    if (!res.ok) {
      console.error("finance access-request email failed:", await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("finance access-request error:", e?.message);
    return { ok: false };
  }
}
