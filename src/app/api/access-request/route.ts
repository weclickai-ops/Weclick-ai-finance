import { NextResponse } from "next/server";

/**
 * Emails the owner when someone requests finance access.
 * Set RESEND_API_KEY and ADMIN_NOTIFY_EMAIL in Vercel.
 * Missing either → quietly no-ops so signup never breaks.
 */
export async function POST(req: Request) {
  try {
    const { email, full_name } = await req.json();
    const key = process.env.RESEND_API_KEY;
    const to = process.env.ADMIN_NOTIFY_EMAIL;
    if (!key || !to) return NextResponse.json({ ok: true, skipped: true });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.weclickai.com";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "WeClick AI Finance <onboarding@resend.dev>",
        to: [to],
        subject: `Finance access request — ${full_name || email}`,
        html: `
          <div style="font-family:system-ui,sans-serif;font-size:15px;color:#141418">
            <p><strong>${full_name || "Someone"}</strong> asked for access to WeClick AI Finance.</p>
            <p style="color:#6B7280">Email: ${email}</p>
            <p>They cannot see any figures until you approve them.</p>
            <p><a href="${appUrl}/settings/team"
                  style="background:#FF6200;color:#fff;padding:10px 16px;border-radius:8px;
                         text-decoration:none;display:inline-block">Review the request</a></p>
            <p style="color:#6B7280;font-size:13px">
              Approving happens inside the app after you sign in — this link only takes you there.
            </p>
          </div>`,
      }),
    });
    if (!res.ok) {
      console.error("finance access-request email failed:", await res.text());
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("finance access-request error:", e?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
