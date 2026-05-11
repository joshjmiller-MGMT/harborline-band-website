-- Sub-Plan 03 v2 Cut 4 — link rendered run_of_show rows back to their
-- canonical source. Nullable so the existing generate-run-of-show path
-- (which does not yet read from canonical_events) keeps working.
--
-- ON DELETE SET NULL: deleting a canonical row is rare but recoverable;
-- orphaned run_of_show rows lose the back-pointer without disappearing.

ALTER TABLE public.run_of_show
  ADD COLUMN IF NOT EXISTS canonical_event_id uuid
  REFERENCES public.canonical_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS run_of_show_canonical_event_id_idx
  ON public.run_of_show (canonical_event_id);
