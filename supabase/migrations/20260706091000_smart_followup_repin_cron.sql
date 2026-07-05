-- Daily cron for recurring follow-ups: walk each open recurring follow-up's
-- calendar block forward to an open mid-day slot until Josh moves it to Done.
-- Mirrors trigger_claude_action_smartify exactly (net.http_post + stored anon
-- JWT + x-cron-secret). Runs 11:30 UTC = 7:30am ET, ahead of the 9am morning
-- routine so the day's follow-ups are already re-pinned when Josh looks.

create or replace function public.trigger_smart_followup_repin()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/smart-followup-repin?action=drain';
  cron_secret text;
  anon_jwt text;
begin
  select secret into cron_secret
    from public.cron_secrets where name = 'trello_route_cron_secret' limit 1;
  if cron_secret is null then
    raise exception 'trello_route_cron_secret not found in cron_secrets';
  end if;

  select secret into anon_jwt
    from public.cron_secrets where name = 'supabase_anon_jwt' limit 1;
  if anon_jwt is null then
    raise exception 'supabase_anon_jwt not found in cron_secrets';
  end if;

  select net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('action', 'drain'),
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$function$;

-- (Re)schedule idempotently.
select cron.unschedule('smart-followup-repin-daily')
  where exists (select 1 from cron.job where jobname = 'smart-followup-repin-daily');

select cron.schedule(
  'smart-followup-repin-daily',
  '30 11 * * *',
  'select public.trigger_smart_followup_repin();'
);
