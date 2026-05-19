-- P331a — Daily cron: integration-health-check at 11:00 UTC (7am ET during EDT,
-- 6am ET during EST; the dashboard widget tolerates a ~1hr DST drift since the
-- "Refresh all" button can pull fresh state on demand).
--
-- Auth pattern: pg_net cannot mint a service-role JWT, so the cron passes a
-- shared `x-cron-secret` header. The edge fn looks the secret up from the
-- canonical `public.cron_secrets` table on first cron-flagged request and
-- caches it for the worker lifetime — no Edge Functions env var to manage.
-- The cron also passes the published anon JWT as Authorization Bearer so the
-- platform's verify_jwt=true gate accepts the request before the edge fn's
-- own x-cron-secret bypass runs.
--
-- Secret storage: the posting-times migration used `vault.secrets`, but that
-- requires pgsodium privileges the migration runner role doesn't carry on
-- this project — so this migration uses a plain `cron_secrets` table with
-- RLS on, no policies, and read access mediated by service-role bypass
-- (edge fn) or SECURITY DEFINER (cron trigger fn). The secret never leaves
-- Postgres except via those two callers.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Storage for cron shared secrets. RLS-on, no policies: only role-bypassing
-- callers (service-role JWT via PostgREST, or SECURITY DEFINER pg fns) can
-- read or write.
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

-- Idempotent seed of this cron's secret. `extensions.gen_random_bytes` works
-- under the migration runner role; the vault crypto path does not.
INSERT INTO public.cron_secrets (name, secret, description)
SELECT
  'integration_health_check_cron_secret',
  encode(extensions.gen_random_bytes(32), 'hex'),
  'Shared secret used by the daily integration-health-check cron to authenticate to the edge function (sent as x-cron-secret header).'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cron_secrets WHERE name = 'integration_health_check_cron_secret'
);

-- The published anon JWT — used by pg_cron's pg_net call to satisfy platform
-- verify_jwt before the edge fn's x-cron-secret bypass takes over. This is the
-- same value as the frontend `client.ts` SUPABASE_PUBLISHABLE_KEY (legacy
-- anon-format JWT). Embedding here is safe — anon is publishable, never
-- carries operator privileges; the actual authorization gate is the
-- x-cron-secret column above. The migration deliberately writes a literal
-- (rather than reading from a vault path) because Postgres cron triggers
-- cannot otherwise discover the project's anon key from inside SQL.
INSERT INTO public.cron_secrets (name, secret, description)
SELECT
  'supabase_anon_jwt',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icXl6bnR0cHZlYmFoZ3lnc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY5MzksImV4cCI6MjA5MzEzMjkzOX0.mecTrCsLrvsL09CzH6d-bNSylwMZuIlegAatWYxCCxY',
  'Published Supabase anon JWT (role=anon). Used by cron triggers to satisfy platform verify_jwt; not an authorization grant.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cron_secrets WHERE name = 'supabase_anon_jwt'
);

CREATE OR REPLACE FUNCTION public.trigger_integration_health_check()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  request_id bigint;
  fn_url text := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/integration-health-check';
  cron_secret text;
  anon_jwt text;
BEGIN
  SELECT secret INTO cron_secret
    FROM public.cron_secrets
    WHERE name = 'integration_health_check_cron_secret'
    LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'integration_health_check_cron_secret not found in cron_secrets';
  END IF;

  -- The edge fn keeps verify_jwt=true (so requireOperator on operator-JWT calls
  -- continues benefitting from platform JWT signature verification). Cron calls
  -- must therefore present a signed JWT *and* the cron-secret header. The anon
  -- JWT is published (frontend `client.ts` embeds it) so storing it inline here
  -- is safe; the actual authorization gate is x-cron-secret.
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
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 120000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('integration-health-check-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'integration-health-check-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'integration-health-check-daily',
  '0 11 * * *',
  $cron$ SELECT public.trigger_integration_health_check(); $cron$
);
