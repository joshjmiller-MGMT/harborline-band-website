-- Daily prefetch of availability for today + next 6 days.
-- Pre-warms availability_cache so dashboard loads instantly each morning.
-- Scheduled at 09:05 UTC (5am ET during EST, 6am ET during EDT) — five minutes
-- after the posting-times refresh so the two crons don't fire in the same instant.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_availability_prefetch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/availability-checker';
  target_date date;
  i integer;
BEGIN
  -- Fire 7 fan-out requests (today through today+6). pg_net is async, so the
  -- function returns immediately — each availability-checker run cooks the
  -- cache row for its date independently.
  FOR i IN 0..6 LOOP
    target_date := (current_date + i)::date;
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'date', to_char(target_date, 'YYYY-MM-DD'),
        'force', true
      ),
      timeout_milliseconds := 90000
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('availability-prefetch-7-days')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'availability-prefetch-7-days');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'availability-prefetch-7-days',
  '5 9 * * *',
  $cron$ SELECT public.trigger_availability_prefetch(); $cron$
);
