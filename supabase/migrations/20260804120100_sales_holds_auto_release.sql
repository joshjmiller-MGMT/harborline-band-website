-- sales_holds auto-release + weekly self-check (2026-08-04).
--
-- Why: holds-from-calendar inserts and refreshes yellow-hold rows but never
-- releases them. The "TSB Hold" for 8/1 sat open until a manual sweep on 8/3
-- released it by hand. Rule now automated: an open hold whose event_date has
-- passed with no confirmation is released.
--
-- Two jobs:
--   sales-holds-auto-release-daily (11:55 UTC, after the 11:45 calendar sync)
--     -> release_expired_sales_holds(): flips open+past-date holds to
--        'released' and stamps the note the same way the 8/3 manual sweep did.
--   sales-holds-weekly-check (Mon 12:05 UTC)
--     -> sales_holds_weekly_check(): runs the release once more, then audits
--        itself — if expired holds are still open OR the daily job logged no
--        successes in 8 days, it files a high-priority waiting_on_josh item
--        instead of failing silently (the availability_cache lesson: a cron
--        that dies quietly lies for weeks).
--
-- This file records the already-applied prod state (applied via Mgmt API
-- during the 8/4 overnight window; first daily run succeeded 11:55 UTC 8/4).

CREATE OR REPLACE FUNCTION public.release_expired_sales_holds()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  released_count integer;
BEGIN
  WITH released AS (
    UPDATE public.sales_holds
       SET hold_status = 'released',
           notes = coalesce(notes, '') ||
             ' [auto-release ' || to_char(current_date, 'FMMM/FMDD') ||
             ': event date ' || to_char(event_date, 'FMMM/FMDD') ||
             ' passed with no confirmation - released]',
           updated_at = now()
     WHERE hold_status = 'open'
       AND event_date < current_date
    RETURNING id
  )
  SELECT count(*) INTO released_count FROM released;
  RETURN released_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sales_holds_weekly_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  released integer;
  still_expired integer;
  daily_runs integer;
BEGIN
  released := public.release_expired_sales_holds();

  SELECT count(*) INTO still_expired
    FROM public.sales_holds
   WHERE hold_status = 'open' AND event_date < current_date;

  SELECT count(*) INTO daily_runs
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'sales-holds-auto-release-daily'
     AND d.status = 'succeeded'
     AND d.start_time > now() - interval '8 days';

  IF (still_expired > 0 OR daily_runs = 0)
     AND NOT EXISTS (SELECT 1 FROM public.waiting_on_josh
                      WHERE source_ref = 'sales-holds-check' AND resolved_at IS NULL) THEN
    INSERT INTO public.waiting_on_josh (title, detail, item_type, priority, source_session, source_ref)
    VALUES (
      'Sales-holds auto-release is not keeping up',
      'Weekly check found ' || still_expired || ' open hold(s) past their event date and ' ||
      daily_runs || ' successful daily release runs in the last 8 days. The daily pg_cron job sales-holds-auto-release-daily may be broken.',
      'general', 'high', 'sales-holds-weekly-check', 'sales-holds-check');
  END IF;

  RETURN jsonb_build_object('released', released, 'still_expired', still_expired, 'daily_runs_8d', daily_runs);
END;
$function$;

-- cron owns these; nothing client-facing should call them via PostgREST
revoke execute on function public.release_expired_sales_holds() from public, anon, authenticated;
revoke execute on function public.sales_holds_weekly_check() from public, anon, authenticated;

select cron.schedule(
  'sales-holds-auto-release-daily',
  '55 11 * * *',
  'select public.release_expired_sales_holds();'
);

select cron.schedule(
  'sales-holds-weekly-check',
  '5 12 * * 1',
  'select public.sales_holds_weekly_check();'
);
