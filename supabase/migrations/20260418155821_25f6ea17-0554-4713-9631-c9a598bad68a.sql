ALTER TABLE public.monday_calendar_sources
ADD COLUMN IF NOT EXISTS skip_groups text NOT NULL DEFAULT '';