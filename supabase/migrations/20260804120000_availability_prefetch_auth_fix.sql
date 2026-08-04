-- availability_cache 45-day no-op fix (2026-08-04).
--
-- Root cause: trigger_availability_prefetch posted to availability-checker
-- with NO auth headers. The platform gate (verify_jwt) 401'd every scheduled
-- request, pg_net swallowed the failure async, and cron.job_run_details kept
-- saying "succeeded" — so the cache sat frozen at its last manual write
-- (2026-05-13) while the cron "ran" daily.
--
-- Fix: same shape as trigger_trello_route — anon JWT bearer (passes
-- verify_jwt) + x-cron-secret header that availability-checker validates
-- against cron_secrets and uses to skip the operator gate. The paired edge-fn
-- change (x-cron-secret path in availability-checker) deployed 2026-08-04
-- 04:01 UTC.
--
-- Verified in prod before this file was written: cron fired 09:05 UTC 8/4,
-- seven pg_net 200 responses, seven availability_cache rows (8/4-8/10)
-- updated at 09:05:02 UTC.
--
-- This file records the already-applied prod state (applied via Mgmt API
-- during the 8/4 overnight window).

CREATE OR REPLACE FUNCTION public.trigger_availability_prefetch()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/availability-checker';
  cron_secret text;
  anon_jwt text;
  target_date date;
  i integer;
BEGIN
  -- Fixed 2026-08-04: the original posted with NO auth headers, so every
  -- scheduled request 401'd at the platform gate and the cache sat stale
  -- (last cron write 2026-05-13) while cron.job_run_details said "succeeded"
  -- (pg_net is async). Now sends anon JWT (passes verify_jwt) + x-cron-secret
  -- (availability-checker validates it and skips the operator gate) — the
  -- same shape as trigger_trello_route.
  SELECT secret INTO cron_secret
    FROM public.cron_secrets WHERE name = 'trello_route_cron_secret' LIMIT 1;
  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'trello_route_cron_secret not found in cron_secrets';
  END IF;

  SELECT secret INTO anon_jwt
    FROM public.cron_secrets WHERE name = 'supabase_anon_jwt' LIMIT 1;
  IF anon_jwt IS NULL THEN
    RAISE EXCEPTION 'supabase_anon_jwt not found in cron_secrets';
  END IF;

  -- Fire 7 fan-out requests (today through today+6). pg_net is async, so the
  -- function returns immediately — each availability-checker run cooks the
  -- cache row for its date independently.
  FOR i IN 0..6 LOOP
    target_date := (current_date + i)::date;
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_jwt,
        'x-cron-secret', cron_secret
      ),
      body := jsonb_build_object(
        'date', to_char(target_date, 'YYYY-MM-DD'),
        'force', true
      ),
      timeout_milliseconds := 90000
    );
  END LOOP;
END;
$function$;

-- cron owns this; nothing client-facing should call it via PostgREST
revoke execute on function public.trigger_availability_prefetch() from public, anon, authenticated;
