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
