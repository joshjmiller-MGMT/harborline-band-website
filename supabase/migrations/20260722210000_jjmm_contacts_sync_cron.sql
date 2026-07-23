-- jjmm-contacts-sync hourly cron — two-way /team/contacts ↔ JJMM sheet sync.
-- Josh is actively dumping contacts on both surfaces (7/21 directive), so
-- hourly keeps them converged without him thinking about it; the page also
-- has a manual "Sync sheet" button for immediate runs.
--
-- Follows the trigger_trello_route cron pattern: per-fn secret in
-- cron_secrets + anon bearer (passes verify_jwt) + x-cron-secret header the
-- fn verifies against cron_secrets. There is no service-role JWT anywhere in
-- this project's cron plumbing, by design.

insert into cron_secrets (name, secret)
select 'jjmm_contacts_sync_cron_secret', encode(gen_random_bytes(32), 'hex')
where not exists (
  select 1 from cron_secrets where name = 'jjmm_contacts_sync_cron_secret'
);

create or replace function public.trigger_jjmm_contacts_sync()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/jjmm-contacts-sync';
  cron_secret text;
  anon_jwt text;
BEGIN
  SELECT secret INTO cron_secret FROM public.cron_secrets WHERE name = 'jjmm_contacts_sync_cron_secret' LIMIT 1;
  IF cron_secret IS NULL THEN RAISE EXCEPTION 'jjmm_contacts_sync_cron_secret not found in cron_secrets'; END IF;
  SELECT secret INTO anon_jwt FROM public.cron_secrets WHERE name = 'supabase_anon_jwt' LIMIT 1;
  IF anon_jwt IS NULL THEN RAISE EXCEPTION 'supabase_anon_jwt not found in cron_secrets'; END IF;

  SELECT net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

-- cron owns this; nothing client-facing should call it via PostgREST
revoke execute on function public.trigger_jjmm_contacts_sync() from public, anon, authenticated;

select cron.schedule(
  'jjmm-contacts-sync-hourly',
  '25 * * * *',
  'select public.trigger_jjmm_contacts_sync();'
);
