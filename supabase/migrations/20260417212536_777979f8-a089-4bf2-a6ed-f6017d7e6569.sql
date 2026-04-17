ALTER TABLE public.monday_calendar_sources
  ADD COLUMN IF NOT EXISTS person_column_id text,
  ADD COLUMN IF NOT EXISTS person_id text;