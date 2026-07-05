-- Recurring follow-ups (the "Caitlyn" pattern): a SMART task that re-surfaces
-- on the management calendar every cadence-day until Josh marks it truly done
-- (moves it to the Done bucket). While it sits in 'Active' with
-- recurring_followup = true, the daily smart-followup-repin job walks its
-- calendar block forward to an open mid-day slot each cadence period.
--
--   recurring_followup        — opt-in flag; false for ordinary one-shot tasks.
--   followup_cadence_days     — re-surface every N days (null → daily).
--   followup_last_surfaced_at — last day the re-pin job moved it (dedupe guard).
alter table public.smart_task_enrichments
  add column if not exists recurring_followup boolean not null default false,
  add column if not exists followup_cadence_days integer,
  add column if not exists followup_last_surfaced_at date;

-- The daily job only scans open recurring follow-ups — a partial index keeps
-- that scan cheap as the enrichments table grows.
create index if not exists idx_smart_enrich_open_followups
  on public.smart_task_enrichments (followup_last_surfaced_at)
  where recurring_followup;
