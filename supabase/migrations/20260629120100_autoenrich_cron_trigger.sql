-- trello-smart-superhighway — schedule the recurring auto-enrich pass.
--
-- Companion to the ingest cron `trello-route-every-15-min`
-- (trigger_trello_route → trello-route-cards). This adds the SMARTIFY half:
-- a pg_net wrapper that invokes the `smart-task-autoenrich` edge fn, plus a
-- pg_cron schedule. Together they complete the forward automation:
--   route (ingest, :00/:15/:30/:45)  →  autoenrich (smartify, :07/:22/:37/:52).
-- The 7-minute offset lets a route tick's freshly-ingested cards settle before
-- the smartify tick picks them up, and keeps the two LLM/Trello workloads from
-- overlapping.
--
-- Auth path mirrors trigger_trello_route exactly: SECURITY DEFINER, reads the
-- shared cron secret + anon JWT from public.cron_secrets, calls the edge fn
-- with both the anon Bearer and the x-cron-secret header (the fn's cron-secret
-- bypass accepts that without an operator JWT).
--
-- ⚠ ENABLEMENT NOTE FOR JARSH/JOSH: the smartify list allowlist (SMARTIFY_LISTS
-- in the edge fn) is pending Josh's confirm (non-blocking waiting_on_josh row).
-- The cron is scheduled ACTIVE here for a complete handoff, but if you want to
-- gate it on the allowlist confirm, run
--   select cron.unschedule('smart-task-autoenrich-every-15-min');
-- after apply and re-create once confirmed. Default allowlist is conservative
-- (action buckets only; reference/recurring + Contacts excluded).

create or replace function public.trigger_claude_action_smartify()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/smart-task-autoenrich?action=drain';
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
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$function$;

-- Schedule every 15 minutes, offset 7 min from the route cron.
-- Unschedule any prior copy first so re-applying the migration is idempotent.
do $$
begin
  perform cron.unschedule('smart-task-autoenrich-every-15-min');
exception when others then
  null; -- not previously scheduled
end $$;

select cron.schedule(
  'smart-task-autoenrich-every-15-min',
  '7,22,37,52 * * * *',
  $$ select public.trigger_claude_action_smartify(); $$
);
