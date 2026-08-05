-- =====================================================================
-- CATCH-UP MIGRATION 2: contacts + the four finance_* tables
-- Written 2026-08-05. Documents structure that ALREADY EXISTS IN PROD.
-- =====================================================================
--
-- WHY THIS FILE EXISTS
-- --------------------
-- Same root cause as 20260805130000, one layer out. 26 tables exist in
-- production with no `create table` anywhere in supabase/migrations/. That
-- file wrote back the five the trigger catch-up tripped over. This file
-- writes back the five that matter next, and they matter for a specific
-- reason: the staged RLS tier-1 migration rewrites policies on all five.
--
-- A policy migration against a table the repo cannot create is a trap. It
-- applies cleanly on production, where the table happens to exist, and fails
-- on a fresh clone, where it does not -- so `supabase db reset` diverges from
-- prod exactly on the tables whose access rules are being changed. Writing the
-- tables back first makes the RLS migration mean the same thing in both
-- places.
--
--   contacts              1,043 rows
--   finance_accounts          3 rows
--   finance_statements      197 rows
--   finance_transactions  7,593 rows
--   finance_vendors           1 row
--
-- How invisible were these? `contacts` is referenced by at least six
-- migrations -- the JJMM sync cron, the fan_signups chain, the unified people
-- roster -- and created by none of them. The four finance_* tables are not
-- mentioned in a single migration file. They back the statement-ingest
-- pipeline and hold 7,593 real transactions, and until now the repo contained
-- no evidence they existed at all.
--
-- WHAT THIS FILE IS
-- -----------------
-- A faithful transcription of live production state as of 2026-08-05, project
-- mbqyznttpvebahgygsbx. Every column type, default, nullability, constraint,
-- index, RLS flag and policy below was read out of the catalogue --
-- information_schema.columns, pg_get_constraintdef(), pg_indexes, pg_policies,
-- pg_class.relrowsecurity -- not reconstructed from application code.
--
-- It is DOCUMENTATION, not a change. Production already has all of it. Every
-- object is created behind `if not exists` or a duplicate-object guard, so
-- this file is a NO-OP against the current database and `supabase db reset` on
-- a fresh clone reproduces the real schema.
--
-- ORDERING NOTE
-- -------------
-- finance_accounts must exist before finance_statements, and both before
-- finance_transactions, because of the foreign keys between them. The sections
-- are ordered accordingly; contacts is independent and comes first.
--
-- DELIBERATELY NOT WRITTEN HERE
-- -----------------------------
--   * GRANTs. All five carry the standard Supabase grant set, which arrives
--     from the schema's default privileges on table creation. Access is
--     governed by RLS below, not by these grants. Same call as 20260805130000.
--   * Table and column comments. Not an omission by choice -- production has
--     none on any of the five. Verified against obj_description() and
--     col_description(); both returned empty.
--   * Triggers. There are none on any of these five tables. The dedup and
--     enrichment logic that writes into `contacts` lives on OTHER tables --
--     notably the fan_signups chain -- and is already documented in its own
--     migrations.
--   * Per-column `add column if not exists` fix-ups. As with the first
--     catch-up, no environment has ever held a partial earlier version of
--     these tables, because no migration ever created them. There are only two
--     possible states: production exactly as transcribed, or absent.
--
-- ONE THING WORTH KNOWING BEFORE THE RLS PASS
-- -------------------------------------------
-- `contacts` and the finance tables do NOT use the same policy shape, and the
-- tier-1 rewrite should be deliberate about which one it is standardising on.
-- The four finance tables each carry a single `FOR ALL` policy to
-- `authenticated`. `contacts` instead carries four separate policies, one per
-- command (select / insert / update / delete), all to `authenticated`, all
-- unrestricted. The effective permission today is identical; the shape is not.
-- Four policies is the more useful starting point, because tightening one
-- command there does not require rewriting the other three.
--
-- Also recorded rather than fixed: `contacts` has no unique constraint on
-- email or phone. Its only indexes are the primary key, `name` and `followup`.
-- Contact de-duplication is enforced upstream in trigger logic on the signup
-- path, not by the database. That is a real gap -- a direct insert bypasses it
-- entirely -- but adding a unique index to 1,043 live rows is a behaviour
-- change and does not belong in a documentation catch-up.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. contacts  -- the owned contact roster
-- ---------------------------------------------------------------------
-- 1,043 rows. The single roster behind /team/contacts, the JJMM spreadsheet
-- sync, and fan-broadcast's segment resolution -- fan-broadcast selects from
-- here by `tags @> ARRAY['fan']` or `fan:<slug>`, which is what "the audience
-- is never held by a platform" means in practice.
--
-- `source` defaults to 'trello', which dates the table: it began as the
-- Trello-card contact extract and grew into the general roster. There is no
-- CHECK on it, so the value is descriptive, not enforced.

create table if not exists public.contacts (
  id             uuid        not null default gen_random_uuid(),
  name           text        not null,
  email          text,
  phone          text,
  role           text,
  org            text,
  venture        text,
  tags           text[]      default '{}'::text[],
  followup       boolean     not null default false,
  followup_note  text,
  source         text        not null default 'trello'::text,
  trello_card_id text,
  notes          text,
  sheet_synced   boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint contacts_pkey primary key (id)
);

create index if not exists idx_contacts_followup
  on public.contacts using btree (followup);
create index if not exists idx_contacts_name
  on public.contacts using btree (name);

alter table public.contacts enable row level security;

-- Four per-command policies, not one FOR ALL. Transcribed as they are.
do $$ begin
  create policy "contacts select all"
    on public.contacts for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "contacts insert all"
    on public.contacts for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

-- No WITH CHECK in production. For an UPDATE policy Postgres then applies the
-- USING expression to the new row as well, so this is not a missing half.
do $$ begin
  create policy "contacts update all"
    on public.contacts for update to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "contacts delete all"
    on public.contacts for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 2. finance_accounts  -- the accounts statements are ingested against
-- ---------------------------------------------------------------------
-- 3 rows. Parent of both finance_statements and finance_transactions, so it
-- must be created first. `drive_folder_id` is the Drive folder the statement
-- ingest watches for this account; `venture_default` is the venture a
-- transaction inherits when nothing more specific is derived.

create table if not exists public.finance_accounts (
  id              uuid        not null default gen_random_uuid(),
  name            text        not null,
  kind            text,
  institution     text,
  last4           text,
  venture_default text,
  drive_folder_id text,
  notes           text,
  active          boolean     default true,
  created_at      timestamptz default now(),
  constraint finance_accounts_pkey primary key (id)
);

alter table public.finance_accounts enable row level security;

do $$ begin
  create policy "finance_accounts_authenticated_all"
    on public.finance_accounts for all to authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 3. finance_statements  -- one row per ingested statement file
-- ---------------------------------------------------------------------
-- 197 rows. `drive_file_id` is UNIQUE, and that is the whole re-ingest guard:
-- the same Drive file cannot be ingested twice into two statement rows. It is
-- nullable, and Postgres UNIQUE ignores NULLs, so a hand-entered statement
-- with no Drive origin is still allowed.
--
-- The FK to finance_accounts is ON DELETE SET NULL, not CASCADE: deleting an
-- account must not delete its statement history. Note the deliberate contrast
-- with the CASCADE in section 4.

create table if not exists public.finance_statements (
  id                uuid        not null default gen_random_uuid(),
  account_id        uuid,
  period_date       date,
  drive_file_id     text,
  file_name         text,
  ingest_status     text        default 'pending'::text,
  transaction_count integer     default 0,
  ingested_at       timestamptz,
  created_at        timestamptz default now(),
  constraint finance_statements_pkey primary key (id)
);

do $$ begin
  alter table public.finance_statements
    add constraint finance_statements_drive_file_id_key unique (drive_file_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.finance_statements
    add constraint finance_statements_account_id_fkey
    foreign key (account_id) references public.finance_accounts(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists idx_finance_statements_account
  on public.finance_statements using btree (account_id);

alter table public.finance_statements enable row level security;

do $$ begin
  create policy "finance_statements_authenticated_all"
    on public.finance_statements for all to authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 4. finance_transactions  -- the line items
-- ---------------------------------------------------------------------
-- 7,593 rows, the largest of the five and the reason this file is worth
-- writing. `amount` is numeric(12,2) -- fixed-point money, never float.
--
-- The two foreign keys differ ON PURPOSE and the difference is the data model:
--   * statement_id ON DELETE CASCADE -- a transaction only exists because a
--     statement was parsed. Removing a mis-ingested statement must take its
--     line items with it, or the re-ingest double-counts.
--   * account_id ON DELETE SET NULL -- the transaction really happened.
--     Closing an account must not erase history.
--
-- `description` vs `raw_description`: the raw bank string is kept verbatim
-- alongside the cleaned one, so re-categorisation can be re-derived later
-- without re-reading the source PDF. `merchant_normalized` joins to
-- finance_vendors.normalized_name by value; there is no FK between them.

create table if not exists public.finance_transactions (
  id                  uuid          not null default gen_random_uuid(),
  account_id          uuid,
  statement_id        uuid,
  txn_date            date,
  description         text,
  raw_description     text,
  amount              numeric(12,2),
  direction           text,
  category            text,
  sub_category        text,
  venture             text,
  merchant_normalized text,
  notes               text,
  created_at          timestamptz   default now(),
  constraint finance_transactions_pkey primary key (id)
);

do $$ begin
  alter table public.finance_transactions
    add constraint finance_transactions_account_id_fkey
    foreign key (account_id) references public.finance_accounts(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.finance_transactions
    add constraint finance_transactions_statement_id_fkey
    foreign key (statement_id) references public.finance_statements(id)
    on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_finance_txn_account
  on public.finance_transactions using btree (account_id);
create index if not exists idx_finance_txn_date
  on public.finance_transactions using btree (txn_date);
create index if not exists idx_finance_txn_statement
  on public.finance_transactions using btree (statement_id);

alter table public.finance_transactions enable row level security;

do $$ begin
  create policy "finance_transactions_authenticated_all"
    on public.finance_transactions for all to authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 5. finance_vendors  -- merchant normalisation + default categorisation
-- ---------------------------------------------------------------------
-- 1 row. Effectively empty: the table exists and the pipeline writes through
-- it, but the vendor map has not been populated yet. Recorded as-is rather
-- than seeded -- a catch-up documents what is there.
--
-- `normalized_name` is UNIQUE, which is what makes it usable as the lookup key
-- from finance_transactions.merchant_normalized. `status` defaults to
-- 'ambiguous', i.e. a newly seen merchant is assumed to need a human decision
-- rather than silently inheriting a category. There is no CHECK on it.

create table if not exists public.finance_vendors (
  id              uuid        not null default gen_random_uuid(),
  raw_name        text,
  normalized_name text,
  category        text,
  sub_category    text,
  venture         text,
  recurring       boolean     default false,
  status          text        default 'ambiguous'::text,
  notes           text,
  created_at      timestamptz default now(),
  constraint finance_vendors_pkey primary key (id)
);

do $$ begin
  alter table public.finance_vendors
    add constraint finance_vendors_normalized_name_key unique (normalized_name);
exception when duplicate_object then null;
end $$;

alter table public.finance_vendors enable row level security;

do $$ begin
  create policy "finance_vendors_authenticated_all"
    on public.finance_vendors for all to authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 6. Self-verification
-- ---------------------------------------------------------------------
-- Do not trust a clean exit; count what actually landed and say so out loud.
-- Expected, read from production 2026-08-05 (columns / constraints / indexes
-- / policies):
--
--   contacts              16 / 1 / 3 / 4
--   finance_accounts      10 / 1 / 1 / 1
--   finance_statements     9 / 3 / 3 / 1
--   finance_transactions  14 / 3 / 4 / 1
--   finance_vendors       10 / 2 / 2 / 1
--   ---------------------------------------
--   TOTAL                 59 / 10 / 13 / 8
--
-- Constraint counts are pg_constraint rows on the table itself -- primary key,
-- unique, and foreign key. NOT NULL is a column attribute, not a row there, so
-- it is covered by the column count instead. A foreign key counts against the
-- table that DECLARES it, which is why finance_accounts shows 1 despite being
-- the target of two. Index counts INCLUDE the indexes Postgres builds
-- automatically behind each primary key and unique constraint -- that is why
-- finance_vendors shows 2 with no explicit `create index` at all.

do $verify$
declare
  expected constant text[][] := array[
    ['contacts',             '16', '1', '3', '4'],
    ['finance_accounts',     '10', '1', '1', '1'],
    ['finance_statements',    '9', '3', '3', '1'],
    ['finance_transactions', '14', '3', '4', '1'],
    ['finance_vendors',      '10', '2', '2', '1']
  ];
  t        text;
  n_col    integer;
  n_con    integer;
  n_idx    integer;
  n_pol    integer;
  problems text := '';
  i        integer;
begin
  for i in 1 .. array_length(expected, 1) loop
    t := expected[i][1];

    if to_regclass('public.' || t) is null then
      problems := problems || format(' %s=MISSING;', t);
      continue;
    end if;

    select count(*) into n_col from information_schema.columns
      where table_schema = 'public' and table_name = t;
    select count(*) into n_con from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t;
    select count(*) into n_idx from pg_indexes
      where schemaname = 'public' and tablename = t;
    select count(*) into n_pol from pg_policies
      where schemaname = 'public' and tablename = t;

    if n_col <> expected[i][2]::int or n_con <> expected[i][3]::int
       or n_idx <> expected[i][4]::int or n_pol <> expected[i][5]::int then
      problems := problems || format(
        ' %s=got %s/%s/%s/%s want %s/%s/%s/%s;',
        t, n_col, n_con, n_idx, n_pol,
        expected[i][2], expected[i][3], expected[i][4], expected[i][5]);
    end if;

    if not (select relrowsecurity from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = t) then
      problems := problems || format(' %s=RLS_OFF;', t);
    end if;
  end loop;

  if problems = '' then
    raise notice '[catch-up 20260805140000] OK - all 5 tables match production: 59 columns, 10 constraints, 13 indexes, 8 policies, RLS on everywhere.';
  else
    raise warning '[catch-up 20260805140000] MISMATCH (columns/constraints/indexes/policies):%', problems;
  end if;
end
$verify$;
