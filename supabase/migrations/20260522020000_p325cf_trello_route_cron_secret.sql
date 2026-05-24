-- P325cf — x-cron-secret bypass for trello-route-cards.
--
-- Mirrors P331a's integration-health-check cron-bypass pattern. The bypass
-- lets pg_net callers (this migration's trigger_trello_*() fns) invoke
-- trello-route-cards without an operator JWT — useful because:
--   1. Orchestrator-pickup loop (P325c) needs to invoke ?action=mark-done
--      19 times in a row after a queue-drain. Doing that via operator
--      JWT means Josh's devtools session has to stay open + the per-call
--      latency is real.
--   2. Future P325d (scheduled remote-agent drain) will invoke ?action=route
--      from a cron job; needs a programmatic auth path.
--
-- All three trigger fns SECURITY DEFINER + service-role bypass on the
-- cron_secrets read. Same pattern as trigger_integration_health_check.

-- 1. Generate + store a cron secret for trello-route-cards.
--    32 random bytes → 64-char hex; sufficient entropy for a shared secret.
INSERT INTO public.cron_secrets (name, secret)
VALUES ('trello_route_cron_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- 2. trigger_trello_mark_done — per-card label-attach wrapper.
--    Returns the pg_net request_id; caller can poll net._http_response if needed.
CREATE OR REPLACE FUNCTION public.trigger_trello_mark_done(p_card_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/trello-route-cards?action=mark-done';
  cron_secret text;
  anon_jwt text;
BEGIN
  SELECT secret INTO cron_secret
    FROM public.cron_secrets
    WHERE name = 'trello_route_cron_secret'
    LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'trello_route_cron_secret not found in cron_secrets';
  END IF;

  SELECT secret INTO anon_jwt
    FROM public.cron_secrets
    WHERE name = 'supabase_anon_jwt'
    LIMIT 1;

  IF anon_jwt IS NULL THEN
    RAISE EXCEPTION 'supabase_anon_jwt not found in cron_secrets';
  END IF;

  SELECT net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('card_id', p_card_id),
    timeout_milliseconds := 30000
  ) INTO request_id;

  RETURN request_id;
END;
$function$;

-- 3. trigger_trello_route — full-route invoker (for P325d cron + ad-hoc orchestrator calls).
CREATE OR REPLACE FUNCTION public.trigger_trello_route()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/trello-route-cards?action=route';
  cron_secret text;
  anon_jwt text;
BEGIN
  SELECT secret INTO cron_secret FROM public.cron_secrets WHERE name = 'trello_route_cron_secret' LIMIT 1;
  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'trello_route_cron_secret not found in cron_secrets';
  END IF;
  SELECT secret INTO anon_jwt FROM public.cron_secrets WHERE name = 'supabase_anon_jwt' LIMIT 1;
  IF anon_jwt IS NULL THEN
    RAISE EXCEPTION 'supabase_anon_jwt not found in cron_secrets';
  END IF;

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
$function$;
