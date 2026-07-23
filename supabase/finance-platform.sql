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
