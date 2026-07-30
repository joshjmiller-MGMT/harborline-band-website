-- Fix dead trello_card_routes completion tracking (7/24 sweep find).
--
-- Root cause: trello_card_routes.completion_* was designed (P325a) to be
-- "populated by the handler when execution finishes" — but no handler, edge fn,
-- or trigger ever wrote it. All 413 routed rows sat with completion_status NULL
-- while 191 cards carried the purple "done by claude" label on Trello.
--
-- The DB-side source of truth for "this routed card is finished" is
-- smart_task_enrichments.board_bucket = 'Done' (the SMART board's Done column;
-- enrichments link back via trello_card_id). The purple Trello label is applied
-- by Claude sessions through the Trello REST API and never lands in this DB,
-- so the enrichment bucket is the only completion signal we can trigger on.
--
-- Why a trigger (not edge-fn code): board_bucket is written from multiple paths
-- (update-smart-task-bucket edge fn, drain fns, direct service-role updates) —
-- a trigger catches every writer, present and future, at the source of truth.

create or replace function public.sync_trello_route_completion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.trello_card_id is null then
    return new;
  end if;

  -- Enrichment landed in Done → stamp the route row complete.
  if new.board_bucket = 'Done'
     and (tg_op = 'INSERT' or old.board_bucket is distinct from 'Done') then
    update trello_card_routes
       set completion_status = 'done',
           completed_at      = coalesce(completed_at, now()),
           completion_notes  = 'auto: smart_task_enrichments.board_bucket=Done (enrichment '
                               || new.id || ')'
     where trello_card_id = new.trello_card_id
       and completion_status is distinct from 'done';

  -- Enrichment moved back OUT of Done → reopen the route row so the
  -- pending partial index (completed_at is null) stays truthful.
  elsif tg_op = 'UPDATE'
        and old.board_bucket = 'Done'
        and new.board_bucket is distinct from 'Done' then
    update trello_card_routes
       set completion_status = null,
           completed_at      = null,
           completion_notes  = 'auto: reopened — enrichment ' || new.id
                               || ' left Done (' || now()::date || ')'
     where trello_card_id = new.trello_card_id
       and completion_status = 'done';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_trello_route_completion on public.smart_task_enrichments;
create trigger trg_sync_trello_route_completion
  after insert or update of board_bucket
  on public.smart_task_enrichments
  for each row
  execute function public.sync_trello_route_completion();

-- Backfill: stamp every route whose enrichment is already sitting in Done.
-- completed_at = now() (the true finish time was never recorded anywhere).
update public.trello_card_routes r
   set completion_status = 'done',
       completed_at      = coalesce(r.completed_at, now()),
       completion_notes  = 'backfill 2026-07-30: enrichment already in Done when completion sync shipped'
  from public.smart_task_enrichments e
 where e.trello_card_id = r.trello_card_id
   and e.board_bucket = 'Done'
   and r.completion_status is null;
