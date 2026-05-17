-- P324 — Instrument-hours sanity-check resampling.
--
-- Adds a temporal axis to `instrument_event_classifications` for the
-- sanity-check pass: which auto-classified rows haven't been re-surfaced
-- for human eyeball lately? Keeps `review_status` semantically clean
-- (auto / needs-review / reviewed / unsure) — resampling = bumping
-- this timestamp and flipping the row to needs-review so it re-enters
-- the existing review queue.
--
-- NULL semantics: never resampled (eligible for a first check). Rows
-- existing pre-P324 start at NULL; the resample picker treats NULL as
-- oldest.

ALTER TABLE public.instrument_event_classifications
  ADD COLUMN IF NOT EXISTS last_resampled_at timestamptz;

-- Picker index: COALESCE(last_resampled_at, '1970-01-01') ASC, event_start DESC.
-- NULLS FIRST on the timestamp gets us the same ordering without the COALESCE.
CREATE INDEX IF NOT EXISTS instrument_event_classifications_resample_picker_idx
  ON public.instrument_event_classifications (last_resampled_at NULLS FIRST, event_start DESC)
  WHERE review_status = 'auto';
