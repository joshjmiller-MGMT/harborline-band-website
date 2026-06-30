-- finances-personal-board — operator-only personal finance board.
--
-- Three tables backing /team/finances: accounts, a transactions ledger, and a
-- vendor-categorization surface. All operator-only: RLS ON with authenticated
-- full CRUD and NO anon/public policy (same model as smart_task_enrichments /
-- waiting_on_josh — the /team area is magic-link gated to Josh). The page adds
-- a soft client-side PIN gate on top; this is the real access control.
--
-- SENSITIVE: personal financial data. Never exposed to a public route/sitemap.

-- ---------------------------------------------------------------------------
-- finance_accounts — one row per bank/credit/debit account.
-- ---------------------------------------------------------------------------
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'checking'
    check (kind in ('checking', 'credit', 'debit', 'savings', 'cash', 'other')),
  last4 text,
  institution text,
  venture text not null default 'Personal'
    check (venture in ('Personal', 'BSE', 'Harborline', 'Economy', 'JMJ')),
  current_balance numeric(14,2),
  balance_as_of date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

-- ---------------------------------------------------------------------------
-- finance_transactions — the ledger. amount is signed: negative = money out,
-- positive = money in.
-- ---------------------------------------------------------------------------
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.finance_accounts(id) on delete set null,
  txn_date date not null default current_date,
  description text not null default '',
  amount numeric(14,2) not null default 0,
  category text,
  venture text not null default 'Personal'
    check (venture in ('Personal', 'BSE', 'Harborline', 'Economy', 'JMJ')),
  vendor text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_transactions_account_idx
  on public.finance_transactions (account_id, txn_date desc);
create index if not exists finance_transactions_date_idx
  on public.finance_transactions (txn_date desc);

-- ---------------------------------------------------------------------------
-- finance_vendors — categorization map for ambiguous merchants. One row per
-- merchant string; assigns a category + venture used to classify transactions.
-- ---------------------------------------------------------------------------
create table if not exists public.finance_vendors (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category text,
  venture text not null default 'Personal'
    check (venture in ('Personal', 'BSE', 'Harborline', 'Economy', 'JMJ')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor)
);

-- updated_at triggers (reuse the generic setter).
create trigger trg_finance_accounts_updated_at
  before update on public.finance_accounts
  for each row execute function public.tg_set_updated_at_p325a();
create trigger trg_finance_transactions_updated_at
  before update on public.finance_transactions
  for each row execute function public.tg_set_updated_at_p325a();
create trigger trg_finance_vendors_updated_at
  before update on public.finance_vendors
  for each row execute function public.tg_set_updated_at_p325a();

-- ---------------------------------------------------------------------------
-- RLS — operator-only. authenticated (= Josh via magic-link) gets full CRUD;
-- no anon/public policy at all, so the data is unreadable off the /team area.
-- ---------------------------------------------------------------------------
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_vendors enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_accounts','finance_transactions','finance_vendors']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (true);', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true);', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true);', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (true);', t||'_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed the known accounts (Josh edits balances/details inline on the board).
-- Idempotent via the unique(name) constraint.
-- ---------------------------------------------------------------------------
insert into public.finance_accounts (name, kind, last4, venture, sort_order) values
  ('Checking',          'checking', '6669', 'Personal',   10),
  ('Credit Card',       'credit',   '5994', 'Personal',   20),
  ('Debit (Economy)',   'debit',    '5704', 'Economy',    30),
  ('BSE',               'other',    null,   'BSE',        40),
  ('Harborline',        'other',    null,   'Harborline', 50)
on conflict (name) do nothing;
