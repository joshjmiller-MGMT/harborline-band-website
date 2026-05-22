-- P336 — SMART-task queue for the Urgent Trello bucket.
--
-- Mirrors `claude_action_queue` (P325a) but feeds the SMART-task pipeline
-- instead of the orchestrator-pickup loop. The dispatcher's new
-- `route_to_smart_board` handler upserts rows here; a separate drainer fn
-- (`smart-task-queue-drain`) picks queued rows up, runs them through the
-- existing `smart-task-rewrite` flow, lands the result in
-- `smart_task_enrichments`, and (when a due_date is present) auto-creates a
-- Google Calendar event so the task surfaces on `UnifiedCalendarWidget`.
--
-- Lifecycle:
--   queued     → fresh row, awaiting drain
--   processing → drainer claimed it (in-flight)
--   smartified → SMART rewrite saved to smart_task_enrichments. status_notes
--                stores 'gcal_created' / 'no_due_date' depending on whether
--                a calendar event was also written. result_artifact stores
--                the enrichment row id.
--   failed     → rewrite or downstream write blew up. status_notes carries
--                the error string.
--
-- RLS-on with NO anon policies. Edge fns (drainer + dispatcher) are the
-- sole access path, gated by requireOperator() with service-role bypass.

create table public.smart_task_queue (
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

create index idx_smart_task_queue_queued
  on public.smart_task_queue (created_at)
  where status = 'queued';

alter table public.smart_task_queue enable row level security;

create trigger trg_smart_task_queue_updated_at
  before update on public.smart_task_queue
  for each row execute function public.tg_set_updated_at_p325a();

-- No seed row in this migration. The dispatcher self-seeds the Urgent →
-- route_to_smart_board route on first run (analogous to the Phase-1 seed of
-- `To Claude` + `website fixes` → route_to_claude_action_queue).
