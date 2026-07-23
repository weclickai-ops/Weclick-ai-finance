# WeClick AI — Finance

Standalone finance platform for WeClick AI. Revenue flows in automatically
from invoice payments; expenses, dues, GST and multi-currency invoicing are
managed here.

**Next.js 15 · Supabase · Tailwind** — deploys GitHub → Vercel.

---

## Setup — do these in order

### 1. Database

In the **same Supabase project as the CRM**, open the SQL Editor and run:

    supabase/00-RUN-THIS-FIRST-all-in-one.sql

That single file contains everything, in the right order:
invoicing upgrade → finance platform → payment method → company/multi-currency.

> If you already ran parts of it before, running it again is fine on a fresh
> setup, but it **drops and recreates `finance_entries` and `payables`** — so
> any expenses already logged would be lost. Leads, campaigns and invoices are
> untouched.

Then check your bank details landed:

    select * from company_settings;

### 2. Vercel environment variables

    NEXT_PUBLIC_SUPABASE_URL       https://xbtjkylkigidwldzrdbh.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY  the anon / public key (starts eyJ...)

**Both must have "Sensitive" turned OFF.** `NEXT_PUBLIC_` values are compiled
into the browser bundle; marking them sensitive stops that and the app fails
with "URL and API key are required".

Optional, for access-request emails:

    RESEND_API_KEY       from resend.com
    ADMIN_NOTIFY_EMAIL   weclickai@gmail.com
    NEXT_PUBLIC_APP_URL  https://finance.weclickai.com

After changing env vars, **redeploy with "Use existing Build Cache" unticked** —
they are baked in at build time.

### 3. Deploy

Push to GitHub → import in Vercel → add the env vars → deploy.

### 4. Get in

Your CRM account already exists in Supabase auth, so **do not use
"Request access"** — it will hang trying to create a duplicate user.

Make yourself the finance owner directly:

```sql
insert into finance_users (id, email, full_name, role, active)
select id, email, 'Your Name', 'owner', true
from auth.users where email = 'you@weclickai.com'
on conflict (id) do update set role = 'owner', active = true;
```

Then go to `/login`, click **Sign in**, and use your existing password.

Anyone *without* a CRM account can use **Request access** normally — they land
on a waiting screen until you approve them under Settings → Team access.

---

## Sections

| Page | What it does |
|---|---|
| Overview | Money in/out/net, GST held, cash flow, approval queue. Week / Month / FY toggle. |
| Invoices | Raise invoices in any of 15 currencies; printable document with your logo, bank details and terms. |
| Money in | Invoice payments plus manual entries — offline cash, bank deposits, other income. |
| Money out | Team logs expenses, owner/accountant approves. Pending never counts in totals. |
| Dues | Outstanding invoice balances (automatic) and what you owe (manual). |
| Reports | 6-month P&L, GST collected vs reserved, CSV exports for your CA. |
| Settings | Company & invoice details, expense categories, team access. |

## How it connects to the CRM

Same Supabase project, separate app, **separate accounts**. A CRM login grants
nothing here — finance access is requested and granted separately.

- Payments recorded against an invoice (in either app) show as revenue here
- Unpaid and part-paid balances appear under Dues → Owed to us
- Invoice numbers come from one shared series, so they never clash

## Notes

- **Overdue is never stored** — it's derived from the due date plus the
  outstanding balance, so invoices age on their own.
- **Exchange rates are locked to the invoice** at the moment you raise it, so
  historic books don't shift when rates move.
- **GST is set per invoice** — 18% default, 0 for exports under an LUT.
- **FY means 1 April – 31 March**, matching Indian filing.
- Bank details live in the database (`company_settings`), never in this repo.

## Still to fill in

Under **Settings → Company & invoice**: registered address, GSTIN, PAN,
invoice email/phone, SWIFT code, UPI ID. They print blank until you add them.

## Logo

`public/logo.png` — currently 212×55px, which is soft on a printed PDF.
Replace with an SVG or larger PNG for crisp invoices.
