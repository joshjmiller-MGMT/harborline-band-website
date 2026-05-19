-- P325a — Trello-bucket router schema.
--
-- Three tables. Routes config + per-card audit + a queue for the
-- Claude-execution handler (the only handler in Phase 1).
--
-- All RLS-on with NO anon policies. Edge functions are the sole writer/reader,
-- gated by requireOperator(). Service-role bypass remains.

-- ---------------------------------------------------------------------------
-- trello_bucket_routes — config: Trello list → action handler
-- ---------------------------------------------------------------------------
-- One row per (board_id, list_name). Maps the bucket a card lives in to
-- the handler that will route it. enabled=false disables a route without
-- deleting the audit history. priority resolves multi-match (e.g. exact
-- list_id pin overrides a name match).
create table public.trello_bucket_routes (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  list_name text not null,
  list_id text,
  action_handler text not null,
  handler_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, list_name)
);

create index idx_trello_bucket_routes_enabled
  on public.trello_bucket_routes (board_id, list_name)
  where enabled = true;

alter table public.trello_bucket_routes enable row level security;
-- No policies. Service-role bypasses RLS; edge fns are the sole access path.

-- ---------------------------------------------------------------------------
-- trello_card_routes — audit: one row per routed Trello card
-- ---------------------------------------------------------------------------
-- Idempotency anchor for the dispatcher: once a card_id is in this table,
-- the router skips re-dispatching unless completion_status='failed' or the
-- row is explicitly cleared. completion_* fields populated by the handler
-- when execution finishes (P325b+). raw_card_snapshot preserves the card
-- payload at route time for replay/debug.
create table public.trello_card_routes (
  trello_card_id text primary key,
  route_id uuid references public.trello_bucket_routes(id) on delete set null,
  action_handler text not null,
  routed_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_status text,
  completion_notes text,
  persisted_ref text,
  raw_card_snapshot jsonb not null
);

create index idx_trello_card_routes_pending
  on public.trello_card_routes (routed_at)
  where completed_at is null;

alter table public.trello_card_routes enable row level security;

-- ---------------------------------------------------------------------------
-- claude_action_queue — queue for the route_to_claude_action_queue handler
-- ---------------------------------------------------------------------------
-- Phase 1 handler dumps Trello cards from `To Claude` + `website fixes`
-- into this queue. An orchestrator-pickup loop (next Claude Code session
-- reads queued rows at start) is the Phase 1 execution model. Approach B
-- (scheduled remote agent) would drain this same queue from a /schedule
-- routine — same table, different drainer.
create table public.claude_action_queue (
  id uuid primary key default gen_random_uuid(),
  trello_card_id text not null references public.trello_card_routes(trello_card_id) on delete cascade,
  card_name text not null,
  card_desc text,
  card_url text not null,
  list_name text not null,
  status text not null default 'queued',
  status_notes text,
  picked_up_at timestamptz,
  picked_up_by text,
  completed_at timestamptz,
  result_artifact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trello_card_id)
);

create index idx_claude_action_queue_queued
  on public.claude_action_queue (created_at)
  where status = 'queued';

alter table public.claude_action_queue enable row level security;

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared util, but local-define to avoid cross-mig deps)
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at_p325a()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_trello_bucket_routes_updated_at
  before update on public.trello_bucket_routes
  for each row execute function public.tg_set_updated_at_p325a();

create trigger trg_claude_action_queue_updated_at
  before update on public.claude_action_queue
  for each row execute function public.tg_set_updated_at_p325a();

-- ---------------------------------------------------------------------------
-- NO seed rows in this migration.
-- ---------------------------------------------------------------------------
-- The two Phase-1 seed rows (To Claude + website fixes) require the live
-- TRELLO_BOARD_ID which is held in Supabase edge-function secrets, not
-- exposed to migrations. P325b dispatcher will self-seed on first run:
-- if trello_bucket_routes is empty for the discovered board, it inserts
-- the two default routes pointing to route_to_claude_action_queue.
