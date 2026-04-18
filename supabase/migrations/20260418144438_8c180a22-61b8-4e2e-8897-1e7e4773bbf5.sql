ALTER TABLE public.monday_calendar_sources
  ADD COLUMN IF NOT EXISTS fallback_date_column_ids text NOT NULL DEFAULT '';

UPDATE public.monday_calendar_sources
   SET person_id = '54492562,97563930'
 WHERE label IN ('Leads - Action Items', 'Events - Action Items');

UPDATE public.monday_calendar_sources
   SET fallback_date_column_ids = 'date_mknkt71f,date__1'
 WHERE label = 'Leads - Action Items';