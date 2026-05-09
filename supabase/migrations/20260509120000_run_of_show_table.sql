-- run_of_show table — generated event docs that lock a date.
-- generate-run-of-show edge function upserts a row per (event_date, venue, organization)
-- when an event date is parseable from the source sheet.
-- availability-checker queries this table; any row for a given date is a strong
-- "this date is locked in" signal that bumps the verdict to confirmed_busy.

CREATE TABLE public.run_of_show (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  event_name text,
  venue text,
  organization text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX run_of_show_event_date_idx
  ON public.run_of_show (event_date);

-- One row per (date, venue, organization) so re-generating updates instead of duplicating.
-- COALESCE ensures null-valued venue/org still satisfy the unique constraint.
CREATE UNIQUE INDEX run_of_show_unique_event_idx
  ON public.run_of_show (event_date, COALESCE(venue, ''), COALESCE(organization, ''));

ALTER TABLE public.run_of_show ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view run_of_show"
  ON public.run_of_show FOR SELECT USING (true);

CREATE POLICY "Service role can insert run_of_show"
  ON public.run_of_show FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update run_of_show"
  ON public.run_of_show FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete run_of_show"
  ON public.run_of_show FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.run_of_show_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER run_of_show_updated_at
  BEFORE UPDATE ON public.run_of_show
  FOR EACH ROW
  EXECUTE FUNCTION public.run_of_show_set_updated_at();
