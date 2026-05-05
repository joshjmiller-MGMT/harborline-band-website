-- Daily cron at 5am ET (09:00 UTC during EST, 10:00 UTC during EDT).
-- pg_cron only supports UTC; we schedule at 09:00 UTC and accept 1hr drift across DST.
-- That's still well before the widget's 6am-ET stale-check.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- One-time generation of the shared secret cron uses to authenticate to the
-- posting-times edge function. Josh copies this value into Supabase Edge
-- Functions secrets as POSTING_TIMES_CRON_SECRET (one manual step, recorded
-- in the decision log).
INSERT INTO vault.secrets (name, secret, description)
SELECT
  'posting_times_cron_secret',
  encode(extensions.gen_random_bytes(32), 'hex'),
  'Shared secret used by the daily posting-times cron to authenticate to the edge function. Copy this value into Edge Functions secrets as POSTING_TIMES_CRON_SECRET.'
WHERE NOT EXISTS (
  SELECT 1 FROM vault.secrets WHERE name = 'posting_times_cron_secret'
);

CREATE OR REPLACE FUNCTION public.trigger_posting_times_refresh()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/posting-times';
  cron_secret text;
BEGIN
  SELECT decrypted_secret INTO cron_secret
    FROM vault.decrypted_secrets
    WHERE name = 'posting_times_cron_secret'
    LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'posting_times_cron_secret not found in vault';
  END IF;

  SELECT net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('source', 'cron', 'scrape', true),
    timeout_milliseconds := 120000
  ) INTO request_id;

  PERFORM public.cleanup_old_posting_times_sources();
  RETURN request_id;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('posting-times-daily-refresh')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'posting-times-daily-refresh');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'posting-times-daily-refresh',
  '0 9 * * *',
  $cron$ SELECT public.trigger_posting_times_refresh(); $cron$
);
