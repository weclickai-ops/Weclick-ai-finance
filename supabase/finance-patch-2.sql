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
