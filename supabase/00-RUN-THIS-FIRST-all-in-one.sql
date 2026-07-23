-- =====================================================================
-- WeClick AI - FULL finance setup. Run ONCE, top to bottom.
-- Run in the SAME Supabase project as the CRM.
-- Prerequisite: the CRM's schema.sql is already applied.
-- =====================================================================


-- #####################################################################
-- PART 1 of 4 — professional invoicing (partial payments + payment ledger)
-- #####################################################################
-- =====================================================================
-- WeClick AI — professional invoicing
-- Run ONCE in the Supabase SQL editor, after schema.sql.
--
-- Adds: partial payments, a payment ledger, and accounting-grade statuses.
-- Existing invoices keep their data — 'paid' ones get amount_paid = total.
-- =====================================================================

-- ---------- 1. statuses ----------
-- draft          created, not issued
-- sent           issued, awaiting payment
-- partially_paid some money received, balance outstanding
-- paid           settled in full
-- void           cancelled, never collectable
-- written_off    bad debt, written out of the books
--
-- "Overdue" is NOT stored — it's derived (due date passed + balance > 0)
-- so an invoice becomes overdue on its own, without anyone updating it.

alter table invoices alter column status drop default;
alter table invoices alter column status type text using status::text;
drop type if exists invoice_status cascade;
create type invoice_status as enum
  ('draft', 'sent', 'partially_paid', 'paid', 'void', 'written_off');
alter table invoices alter column status type invoice_status using status::invoice_status;
alter table invoices alter column status set default 'draft';

-- ---------- 2. how much has actually come in ----------
alter table invoices add column if not exists amount_paid numeric(12,2) not null default 0;
update invoices set amount_paid = total where status = 'paid' and amount_paid = 0;

-- ---------- 3. the payment ledger ----------
-- Every receipt is its own dated row. This is what makes partial payments
-- honest, gives you a receipt history, and lets the finance tracker put
-- each payment on the right day.
create table if not exists invoice_payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  method      text not null default 'Bank transfer',
  reference   text,
  note        text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id);
create index if not exists invoice_payments_date_idx    on invoice_payments (paid_on desc);

-- ---------- 4. keep the invoice in sync with its payments ----------
create or replace function sync_invoice_payment_state()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inv_id uuid;
  paid   numeric(12,2);
  inv    invoices%rowtype;
begin
  inv_id := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0) into paid from invoice_payments where invoice_id = inv_id;
  select * into inv from invoices where id = inv_id;

  -- a cancelled or written-off invoice is not resurrected by a payment
  if inv.status in ('void', 'written_off') then
    update invoices set amount_paid = paid where id = inv_id;
    return coalesce(new, old);
  end if;

  update invoices set
    amount_paid = paid,
    status = case
               when paid <= 0            then (case when inv.status = 'draft' then 'draft' else 'sent' end)::invoice_status
               when paid >= inv.total    then 'paid'::invoice_status
               else 'partially_paid'::invoice_status
             end,
    paid_at = case when paid >= inv.total
                   then (select max(paid_on)::timestamptz from invoice_payments where invoice_id = inv_id)
                   else null end
  where id = inv_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_invoice_payment on invoice_payments;
create trigger on_invoice_payment
  after insert or update or delete on invoice_payments
  for each row execute function sync_invoice_payment_state();

-- ---------- 5. RLS ----------
alter table invoice_payments enable row level security;
create policy ip_read  on invoice_payments for select using (is_staff());
create policy ip_write on invoice_payments for all using (is_staff()) with check (is_staff());


-- #####################################################################
-- PART 2 of 4 — finance platform (separate accounts, entries, payables)
-- #####################################################################
-- =====================================================================
-- WeClick AI — Finance platform
-- Run ONCE in the SAME Supabase project as the CRM, AFTER:
--   schema.sql  →  invoices-pro.sql
--
-- Finance access is completely independent of the CRM. Having a CRM
-- account grants NOTHING here — you must be granted finance access
-- separately. The finance app only ever READS invoices; it can never
-- change a lead, a campaign, or an invoice.
-- =====================================================================

drop table if exists finance_entries cascade;
drop table if exists payables cascade;
drop table if exists finance_categories cascade;
drop table if exists finance_users cascade;

do $$ begin create type finance_role   as enum ('owner','accountant','member'); exception when duplicate_object then null; end $$;
do $$ begin create type finance_kind   as enum ('expense','income','gst_setaside'); exception when duplicate_object then null; end $$;
do $$ begin create type finance_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;

-- ---------- who may see the books ----------
create table finance_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       finance_role not null default 'member',
  active     boolean not null default false,   -- granted by an owner
  created_at timestamptz not null default now()
);

create or replace function fin_is_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.finance_users where id = auth.uid() and active = true);
$$;

create or replace function fin_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.finance_users
                 where id = auth.uid() and active = true and role = 'owner');
$$;

create or replace function fin_can_approve()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.finance_users
                 where id = auth.uid() and active = true and role in ('owner','accountant'));
$$;

-- Signup calls this. It is SECURITY DEFINER so it can create the row even
-- though the user has no access yet. Deliberately NOT a trigger on
-- auth.users — otherwise every CRM signup would also appear here.
create or replace function request_finance_access(p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select count(*) = 0 into is_first from public.finance_users;
  insert into public.finance_users (id, email, full_name, role, active)
  select auth.uid(),
         coalesce((select email from auth.users where id = auth.uid()), ''),
         coalesce(p_full_name, split_part((select email from auth.users where id = auth.uid()), '@', 1)),
         case when is_first then 'owner'::finance_role else 'member'::finance_role end,
         is_first
  on conflict (id) do nothing;
end; $$;
revoke all on function request_finance_access(text) from public;
grant execute on function request_finance_access(text) to authenticated;

-- ---------- expense categories ----------
create table finance_categories (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  position int  not null default 0
);
insert into finance_categories (name, position) values
  ('Salaries',1),('Ads / Meta',2),('Tools / SaaS',3),('Freelancers',4),
  ('Office / rent',5),('Travel',6),('Client delivery',7),('GST',8),('Other',9);

-- ---------- money logged by hand ----------
create table finance_entries (
  id          uuid primary key default gen_random_uuid(),
  kind        finance_kind   not null default 'expense',
  amount      numeric(12,2)  not null check (amount > 0),
  category    text           not null default 'Other',
  note        text,
  entry_date  date           not null default current_date,
  status      finance_status not null default 'pending',
  logged_by   uuid references finance_users(id) on delete set null,
  approved_by uuid references finance_users(id) on delete set null,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on finance_entries (entry_date desc);
create index on finance_entries (status);

-- ---------- money we owe ----------
create table payables (
  id         uuid primary key default gen_random_uuid(),
  label      text          not null,
  amount     numeric(12,2) not null check (amount > 0),
  due_date   date,
  paid       boolean       not null default false,
  created_by uuid references finance_users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table finance_users      enable row level security;
alter table finance_categories enable row level security;
alter table finance_entries    enable row level security;
alter table payables           enable row level security;

create policy fu_self  on finance_users for select using (id = auth.uid());
create policy fu_read  on finance_users for select using (fin_is_user());
create policy fu_owner on finance_users for all
  using (fin_is_owner()) with check (fin_is_owner());

create policy fc_read  on finance_categories for select using (fin_is_user());
create policy fc_write on finance_categories for all
  using (fin_can_approve()) with check (fin_can_approve());

create policy fe_read       on finance_entries for select using (fin_is_user());
create policy fe_insert     on finance_entries for insert with check (fin_is_user());
create policy fe_own_update on finance_entries for update
  using (logged_by = auth.uid() and status = 'pending');
create policy fe_own_delete on finance_entries for delete
  using (logged_by = auth.uid() and status = 'pending');
create policy fe_approve    on finance_entries for update using (fin_can_approve());
create policy fe_admin_del  on finance_entries for delete using (fin_is_owner());

create policy pay_read  on payables for select using (fin_is_user());
create policy pay_write on payables for all
  using (fin_can_approve()) with check (fin_can_approve());

-- ---------- read-only window onto the CRM ----------
-- This is the whole integration: finance can READ invoices and their
-- payments. There is no insert/update/delete policy, so the finance app
-- physically cannot alter anything in the CRM.
drop policy if exists fin_read_invoices on invoices;
create policy fin_read_invoices on invoices for select using (fin_is_user());

drop policy if exists fin_read_invoice_payments on invoice_payments;
create policy fin_read_invoice_payments on invoice_payments for select using (fin_is_user());


-- #####################################################################
-- PART 3 of 4 — payment method on manual entries
-- #####################################################################
-- =====================================================================
-- WeClick AI Finance — patch 2
-- Adds: payment method on manual entries (so offline cash is explicit).
-- Run after finance-platform.sql.
-- =====================================================================

alter table finance_entries
  add column if not exists method text not null default 'Cash';

-- existing rows: expenses were most likely paid from the bank
update finance_entries set method = 'Bank transfer'
where kind = 'expense' and method = 'Cash';

comment on column finance_entries.method is
  'Cash | Bank transfer | UPI | Card | Cheque | Other — how the money actually moved';


-- #####################################################################
-- PART 4 of 4 — company details, multi-currency, invoice numbering
-- #####################################################################
-- =====================================================================
-- WeClick AI — invoicing v2
-- Run ONCE in the shared Supabase project, AFTER:
--   schema.sql → invoices-pro.sql → finance-platform.sql → finance-patch-2.sql
--
-- Adds: company/bank details, multi-currency invoices, invoices raised
-- from the finance app, and a single shared number series starting at 001.
--
-- NOTE: your bank details live HERE, in the database — never in the code.
-- The GitHub repo stays free of account numbers.
-- =====================================================================

-- ---------- 1. company + invoice settings (single row) ----------
create table if not exists company_settings (
  id              int primary key default 1 check (id = 1),
  legal_name      text not null default 'WeClick AI',
  tagline         text default 'Automate. Market. Scale with AI.',
  address         text default '',
  gstin           text default '',
  pan             text default '',
  email           text default '',
  phone           text default '',
  logo_url        text default '/logo.png',

  bank_name       text default '',
  account_name    text default '',
  account_number  text default '',
  ifsc            text default '',
  swift           text default '',
  upi             text default '',

  invoice_prefix  text not null default 'WC-',
  next_number     int  not null default 1,     -- starts at 001
  number_padding  int  not null default 3,     -- 001, 002, ...
  default_terms   text default '',
  base_currency   text not null default 'INR',
  updated_at      timestamptz not null default now()
);

insert into company_settings (id, bank_name, account_name, account_number, ifsc, default_terms)
values (
  1,
  'Kotak Mahindra Bank — Hyderabad, Balanagar',
  'WeClick AI',
  '4051128089',
  'KKBK0007497',
  '1. Payment is due within 15 days of the invoice date.
2. Work begins once the advance is received; final files are handed over after full payment.
3. Late payments may attract interest at 1.5% per month.
4. This is a computer-generated invoice and does not require a signature.
5. Any disputes are subject to Hyderabad jurisdiction.'
)
on conflict (id) do nothing;

-- ---------- 2. invoices: currency, rate, where it was raised ----------
alter table invoices add column if not exists exchange_rate numeric(12,4) not null default 1;
alter table invoices add column if not exists source        text not null default 'crm';   -- crm | finance
alter table invoices add column if not exists client_email  text;
alter table invoices add column if not exists client_address text;
alter table invoices add column if not exists issued_on     date default current_date;

comment on column invoices.exchange_rate is
  'Rate to base currency, locked at the time the invoice is raised. 1 for INR invoices.';

-- amount in base currency, for reporting across currencies
create or replace function invoice_base_total(inv invoices)
returns numeric language sql immutable as $$
  select round(inv.total * inv.exchange_rate, 2);
$$;

-- ---------- 3. one shared number series (CRM + finance), from 001 ----------
create or replace function next_invoice_number()
returns text language plpgsql security definer set search_path = public as $$
declare s company_settings%rowtype; n int;
begin
  update company_settings set next_number = next_number + 1
  where id = 1 returning * into s;
  n := s.next_number - 1;
  return s.invoice_prefix || to_char(now(), 'YYYY') || '-' || lpad(n::text, s.number_padding, '0');
end; $$;
grant execute on function next_invoice_number() to authenticated;

-- ---------- 4. RLS ----------
alter table company_settings enable row level security;

-- both apps read the company block (it prints on invoices)
drop policy if exists cs_read on company_settings;
create policy cs_read on company_settings for select
  using (is_staff() or fin_is_user());

-- only finance owners/accountants edit it — bank details are not CRM business
drop policy if exists cs_write on company_settings;
create policy cs_write on company_settings for update
  using (fin_can_approve()) with check (fin_can_approve());

-- finance can now RAISE invoices too, not just read them
drop policy if exists fin_write_invoices on invoices;
create policy fin_write_invoices on invoices for insert with check (fin_is_user());

drop policy if exists fin_update_invoices on invoices;
create policy fin_update_invoices on invoices for update using (fin_is_user());

-- and record payments against them
drop policy if exists fin_write_payments on invoice_payments;
create policy fin_write_payments on invoice_payments for all
  using (fin_is_user()) with check (fin_is_user());

-- ---------- 5. currency on manual entries ----------
alter table finance_entries add column if not exists currency      text not null default 'INR';
alter table finance_entries add column if not exists exchange_rate numeric(12,4) not null default 1;
