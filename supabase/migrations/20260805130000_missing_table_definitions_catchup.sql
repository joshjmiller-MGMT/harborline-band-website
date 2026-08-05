-- =====================================================================
-- CATCH-UP MIGRATION: the five undocumented tables
-- Written 2026-08-05. Documents structure that ALREADY EXISTS IN PROD.
-- =====================================================================
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The trigger catch-up written earlier today
-- (20260805120000_river_closure_sync_triggers_catchup.sql, "KNOWN GAP")
-- found that five tables it depends on have no `create table` statement
-- anywhere in supabase/migrations/:
--
--     work_claims, work_claim_events, smart_links, trello_writeback,
--     sales_holds
--
-- They were created through the Supabase Management API / MCP in earlier
-- sessions and never written back to the repo. This is second-order drift of
-- the same root cause as the trigger gap: DDL applied out-of-band, no
-- matching file.
--
-- Consequence before this file: a fresh clone plus `supabase db reset`
-- produced a database with no work-claim mutex, no claim audit trail, no
-- smart-link table behind /jjm/*, no Trello write-back outbox and no sales
-- holds table -- while three migrations (20260622150000, 20260804120100,
-- 20260805120100) and fifteen triggers all referenced them. The trigger
-- catch-up had to wrap three of its triggers in `to_regclass()` guards
-- because the tables they attach to did not exist.
--
-- WHAT THIS FILE IS
-- -----------------
-- A faithful transcription of live production state as of 2026-08-05,
-- project mbqyznttpvebahgygsbx. Every column type, default, nullability,
-- constraint, index, RLS flag and policy below was read out of the
-- catalogue -- information_schema.columns, pg_get_constraintdef(),
-- pg_indexes, pg_policies, pg_class.relrowsecurity -- not reconstructed
-- from application code or memory.
--
-- It is DOCUMENTATION, not a change. Production already has all of it. The
-- file is written to be a NO-OP against the current database: every object
-- is created behind `if not exists` or a duplicate-object guard, so
-- re-applying it changes nothing, and `supabase db reset` on a fresh clone
-- reproduces the real schema instead of an empty one.
--
-- ORDERING NOTE (this matters)
-- ----------------------------
-- This file is timestamped 20260805130000, i.e. AFTER the trigger catch-up
-- at 20260805120000. On a fresh reset the triggers run first, find no
-- tables, warn, and skip. So section 6 below re-attaches the three guarded
-- triggers now that the tables exist. Those attachments are existence-
-- checked, so on production -- where all three already exist -- they are
-- genuinely no-ops and never drop a live trigger.
--
-- DELIBERATELY NOT WRITTEN HERE
-- -----------------------------
--   * GRANTs. All five carry the standard Supabase grant set (anon,
--     authenticated, service_role, postgres -- full privileges), which comes
--     from the schema's default privileges automatically on table creation.
--     Writing them out would add noise and could drift from the platform
--     default. Access is governed by RLS below, not by these grants.
--   * The identity sequence work_claim_events_id_seq. It is the implicit
--     sequence of `generated always as identity` with stock parameters
--     (start 1, increment 1, cache 1, no cycle, bigint) and is created by
--     the column definition itself. There is nothing to document separately.
--   * Per-column `add column if not exists` fix-ups. There are only two
--     possible states for these tables in any environment: production,
--     exactly as transcribed here, or a fresh clone where they are absent.
--     No environment has ever held a partial earlier version of them,
--     because no migration ever created them. `create table if not exists`
--     is therefore sufficient and honest; per-column patching would imply a
--     history that does not exist.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. work_claims  -- the cross-session lane mutex
-- ---------------------------------------------------------------------
-- Race-safe claim registry for parallel Claude Code sessions across
-- machines. Two triggers live on it: trg_enforce_done_evidence (the
-- database-level no-fake-done rule) and trg_log_work_claim_event (writes
-- the audit trail into work_claim_events). Both are defined in
-- 20260805120000 and re-attached in section 6.

create table if not exists public.work_claims (
  work_key      text        not null,
  title         text,
  claimed_by    text        not null,
  machine       text,
  branch        text,
  pr_url        text,
  status        text        not null default 'in_progress'::text,
  notes         text,
  claimed_at    timestamptz not null default now(),
  heartbeat_at  timestamptz not null default now(),
  released_at   timestamptz,
  spec_ref      text,
  priority      integer     not null default 50,
  done_evidence text,
  constraint work_claims_pkey primary key (work_key)
);

do $$ begin
  alter table public.work_claims
    add constraint work_claims_status_check
    check ((status = any (array['available'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'abandoned'::text])));
exception when duplicate_object then null;
end $$;

create index if not exists work_claims_status_heartbeat_idx
  on public.work_claims using btree (status, heartbeat_at);

alter table public.work_claims enable row level security;

do $$ begin
  create policy "work_claims_authenticated_all"
    on public.work_claims
    for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

comment on table public.work_claims is
  'Race-safe lane mutex for parallel Claude Code sessions across machines. Claim via INSERT ... ON CONFLICT (work_key) DO UPDATE ... WHERE prior is terminal or heartbeat stale; RETURNING tells you if you won. Heartbeat every active turn; set status=done/abandoned to release.';


-- ---------------------------------------------------------------------
-- 2. work_claim_events  -- append-only claim audit trail
-- ---------------------------------------------------------------------
-- Written only by trg_log_work_claim_event on work_claims. RLS is ON with
-- ZERO policies, which is a deliberate deny-all: nothing holding the anon or
-- authenticated key can read or write it, and the trigger reaches it as
-- service_role / definer, which bypasses RLS. An append-only ledger that the
-- browser could edit would not be a ledger.

create table if not exists public.work_claim_events (
  -- `not null` is redundant (identity implies it) but written out so the
  -- file states the live nullability of every column rather than relying on
  -- the reader knowing that rule
  id            bigint      generated always as identity not null,
  work_key      text        not null,
  old_status    text,
  new_status    text        not null,
  claimed_by    text,
  pr_url        text,
  done_evidence text,
  note          text,
  changed_at    timestamptz not null default now(),
  constraint work_claim_events_pkey primary key (id)
);

create index if not exists work_claim_events_work_key_idx
  on public.work_claim_events using btree (work_key, changed_at desc);

alter table public.work_claim_events enable row level security;

-- no policies by design -- see note above


-- ---------------------------------------------------------------------
-- 3. smart_links  -- public release landing pages
-- ---------------------------------------------------------------------
-- Backs the JJM smart links. This is the one table of the five with a
-- genuine anonymous read path: `public read active smart_links` lets anon
-- SELECT rows where is_active, which is what makes a shared link work for a
-- visitor who is not logged in. The `using (is_active)` clause is the whole
-- of that boundary -- an inactive link is invisible to the public key.

create table if not exists public.smart_links (
  id           uuid        not null default gen_random_uuid(),
  slug         text        not null,
  title        text        not null,
  artist       text        not null default 'Joshua J Miller'::text,
  subtitle     text,
  artwork_url  text,
  release_date date,
  platforms    jsonb       not null default '[]'::jsonb,
  accent       text        default '#efe6cf'::text,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  pixel_id     text,
  tracks       jsonb       not null default '[]'::jsonb,
  constraint smart_links_pkey primary key (id)
);

do $$ begin
  alter table public.smart_links
    add constraint smart_links_slug_key unique (slug);
exception when duplicate_object then null;
end $$;

alter table public.smart_links enable row level security;

do $$ begin
  create policy "authenticated all smart_links"
    on public.smart_links
    for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public read active smart_links"
    on public.smart_links
    for select
    to anon
    using (is_active);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 4. trello_writeback  -- outbox for Trello card completion
-- ---------------------------------------------------------------------
-- A durable queue, not a log. River closure triggers insert (card_id,
-- action) when work finishes; a flusher stamps flushed_at once the Trello
-- API call succeeds. The composite primary key IS the dedup mechanism --
-- two closures of the same card for the same action collapse to one row via
-- ON CONFLICT, so a card cannot be double-completed.
-- RLS is ON with zero policies: deny-all to anon and authenticated, reached
-- only by the definer triggers and the service role.

create table if not exists public.trello_writeback (
  card_id    text        not null,
  action     text        not null default 'complete'::text,
  note       text,
  created_at timestamptz not null default now(),
  flushed_at timestamptz,
  constraint trello_writeback_pkey primary key (card_id, action)
);

alter table public.trello_writeback enable row level security;

-- no policies by design -- see note above


-- ---------------------------------------------------------------------
-- 5. sales_holds  -- yellow-hold pipeline from the calendar
-- ---------------------------------------------------------------------
-- Populated by the holds-from-calendar edge function and worked by three
-- pg_cron functions: release_expired_sales_holds() and
-- sales_holds_weekly_check() (20260804120100) and
-- sales_holds_followup_sweep() (20260805120100). Those three files document
-- the behaviour; this section documents the table they all assume.
--
-- calendar_event_id is UNIQUE because that is the upsert key the edge
-- function conflicts on -- one hold row per calendar event, so a re-sync
-- cannot duplicate a hold. It is nullable, so hand-entered holds with no
-- calendar origin are still allowed (Postgres UNIQUE ignores NULLs).
--
-- KNOWN INCONSISTENCY, recorded rather than fixed here: the
-- followup_cadence CHECK admits 'every-3-days', but
-- sales_holds_followup_sweep() branches on daily / weekly / biweekly /
-- monthly and sends anything else down its `else interval '7 days'` path.
-- An 'every-3-days' hold would therefore be checked weekly -- silently, and
-- not as configured. No row currently uses that value, so nothing is
-- misbehaving today. Changing either side is a behaviour change and does not
-- belong in a documentation catch-up; it is flagged in the brain instead.

create table if not exists public.sales_holds (
  id                    uuid        not null default gen_random_uuid(),
  event_date            date,
  event_label           text,
  sales_rep             text,
  agency                text        default 'BSE'::text,
  role                  text,
  musician              text,
  musician_status       text        default 'available'::text,
  hold_status           text        default 'open'::text,
  followup_cadence      text        default 'weekly'::text,
  last_checked_at       timestamptz,
  next_check_at         timestamptz,
  last_told_musician_at timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  calendar_event_id     text,
  constraint sales_holds_pkey primary key (id)
);

do $$ begin
  alter table public.sales_holds
    add constraint sales_holds_calendar_event_id_key unique (calendar_event_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.sales_holds
    add constraint sales_holds_musician_status_check
    check ((musician_status = any (array['available'::text, 'held'::text, 'confirmed'::text, 'released'::text, 'declined'::text])));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.sales_holds
    add constraint sales_holds_hold_status_check
    check ((hold_status = any (array['open'::text, 'confirmed'::text, 'lost'::text, 'released'::text])));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.sales_holds
    add constraint sales_holds_followup_cadence_check
    check ((followup_cadence = any (array['every-3-days'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text])));
exception when duplicate_object then null;
end $$;

alter table public.sales_holds enable row level security;

do $$ begin
  create policy "authenticated all sales_holds"
    on public.sales_holds
    for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 6. Re-attach the three triggers the earlier catch-up had to skip
-- ---------------------------------------------------------------------
-- 20260805120000 runs one hour of migration-timestamp earlier than this
-- file. On a fresh clone its `to_regclass()` guards found no tables, raised
-- a warning and skipped. The tables exist as of section 5, so attach them
-- now. The three functions -- enforce_done_evidence(), log_work_claim_event()
-- and touch_smart_links() -- were all created by that file with
-- `create or replace function`, which succeeds whether or not the table
-- exists, so they are already present here.
--
-- Existence-checked rather than `drop trigger if exists` + `create`: on
-- production all three already exist, and this file must never drop a live
-- trigger, not even for the microsecond it would take to recreate it.

do $trg$
begin
  if not exists (select 1 from pg_trigger t
                   join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                  where not t.tgisinternal and n.nspname = 'public'
                    and c.relname = 'work_claims' and t.tgname = 'trg_enforce_done_evidence') then
    create trigger trg_enforce_done_evidence
      before insert or update on public.work_claims
      for each row execute function enforce_done_evidence();
  end if;

  if not exists (select 1 from pg_trigger t
                   join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                  where not t.tgisinternal and n.nspname = 'public'
                    and c.relname = 'work_claims' and t.tgname = 'trg_log_work_claim_event') then
    create trigger trg_log_work_claim_event
      after insert or update on public.work_claims
      for each row execute function log_work_claim_event();
  end if;

  if not exists (select 1 from pg_trigger t
                   join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                  where not t.tgisinternal and n.nspname = 'public'
                    and c.relname = 'smart_links' and t.tgname = 'smart_links_touch') then
    create trigger smart_links_touch
      before update on public.smart_links
      for each row execute function touch_smart_links();
  end if;
end
$trg$;


-- ---------------------------------------------------------------------
-- 7. Self-verification
-- ---------------------------------------------------------------------
-- Do not trust a clean exit; count what actually landed and say so out loud.
-- Expected, read from production 2026-08-05 (columns / constraints /
-- indexes / policies):
--
--   work_claims        14 /  2 / 2 / 1
--   work_claim_events   9 /  1 / 2 / 0
--   smart_links        14 /  2 / 2 / 2
--   trello_writeback    5 /  1 / 1 / 0
--   sales_holds        17 /  5 / 2 / 1
--   ------------------------------------
--   TOTAL              59 / 11 / 9 / 4
--
-- Constraint counts are pg_constraint rows (primary key, unique, check).
-- NOT NULL is a column attribute, not a row there, so it is verified by the
-- column count instead. Index counts INCLUDE the indexes Postgres builds
-- automatically behind each primary key and unique constraint -- that is why
-- work_claims shows 2 indexes for 1 explicit `create index`, and why
-- trello_writeback shows 1 with no explicit index at all.

do $verify$
declare
  expected constant text[][] := array[
    ['work_claims',       '14', '2', '2', '1'],
    ['work_claim_events',  '9', '1', '2', '0'],
    ['smart_links',       '14', '2', '2', '2'],
    ['trello_writeback',   '5', '1', '1', '0'],
    ['sales_holds',       '17', '5', '2', '1']
  ];
  t          text;
  n_col      integer;
  n_con      integer;
  n_idx      integer;
  n_pol      integer;
  problems   text := '';
  i          integer;
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
    raise notice '[catch-up 20260805130000] OK - all 5 tables match production: 59 columns, 11 constraints, 9 indexes, 4 policies, RLS on everywhere.';
  else
    raise warning '[catch-up 20260805130000] MISMATCH (columns/constraints/indexes/policies):%', problems;
  end if;
end
$verify$;
