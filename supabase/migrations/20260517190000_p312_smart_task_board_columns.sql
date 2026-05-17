-- P312 — SMART task board: extend smart_task_enrichments with board state
-- so the new /team/smart-tasks board view can persist per-card column +
-- venture-swim-lane placement without a separate overlay table. Keeps board
-- state co-located with SMART state; no drift.
--
-- board_bucket is one of:
--   'Needs SMART'      — flagged for SMART-ification (manual placement)
--   'Pending approval' — rewrite generated but not yet saved (currently
--                        in-memory in the widget — reserved for future
--                        persisted-draft path)
--   'Active'           — saved + calendar event live (default for new SMART
--                        tasks; column inferred as Active when null and a
--                        google_calendar_event_id is set)
--   'Done'             — past event + cleaned up
--
-- 'Trello inbox' is rendered from trello-poll output, not from a row here.
--
-- board_venture is the swim-lane label; one of the canonical six. Default
-- 'Personal'; Josh re-classifies via the board's per-card "Move venture"
-- dropdown.

alter table public.smart_task_enrichments
  add column if not exists board_bucket text,
  add column if not exists board_venture text;

create index if not exists smart_task_enrichments_board_bucket_idx
  on public.smart_task_enrichments (board_bucket);

create index if not exists smart_task_enrichments_board_venture_idx
  on public.smart_task_enrichments (board_venture);

-- The original migration left no UPDATE policy on this table (insert/select/
-- delete only). The board edge fn uses the service role so it doesn't need
-- one, but adding a permissive update keeps the table consistent with the
-- existing rest-of-portal access pattern. Reads/inserts are already wide-
-- open by design — operator gating happens upstream (edge fn requireOperator
-- + client auth).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_task_enrichments'
      and policyname = 'smart_task_enrichments update all'
  ) then
    create policy "smart_task_enrichments update all"
      on public.smart_task_enrichments for update using (true) with check (true);
  end if;
end $$;
