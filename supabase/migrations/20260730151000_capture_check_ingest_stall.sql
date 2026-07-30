-- Repo capture of an existing live DB object (no behavior change).
--
-- public.check_ingest_stall() + pg_cron job "ingest-stall-check-6h"
-- (schedule '5 */6 * * *', jobid 15) were created directly in the DB on
-- 2026-07-22 (ingest-resilience job) and never committed as a migration —
-- which is exactly why the 7/28 audit couldn't find what the cron did.
-- This file makes the definition discoverable in the repo. CREATE OR REPLACE
-- is idempotent against the identical live definition.
--
-- Behavior (verified live 2026-07-30): every 6h, if the newest
-- content_ingest_log row is >30h old and no unresolved 'ingest-stall' card
-- exists, INSERT one high-priority waiting_on_josh card (deduped via
-- source_ref='ingest-stall'). /team/review renders all unresolved
-- waiting_on_josh rows, so the card is on Josh's single review surface.

CREATE OR REPLACE FUNCTION public.check_ingest_stall()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  last_row timestamptz;
BEGIN
  SELECT max(ingested_at) INTO last_row FROM content_ingest_log;
  IF last_row IS NULL OR last_row > now() - interval '30 hours' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM waiting_on_josh WHERE source_ref='ingest-stall' AND resolved_at IS NULL) THEN RETURN; END IF;
  INSERT INTO waiting_on_josh (title, detail, item_type, priority, source_session, source_ref)
  VALUES (
    'Content ingest has been silent for 30+ hours',
    'Last content_ingest_log row: ' || to_char(last_row, 'YYYY-MM-DD HH24:MI UTC') ||
    '. If the DM-webhook pipeline is live, check meta_tokens.last_error + the meta-webhook logs; if you are still on the browser-session capture, the tab has died again.',
    'general', 'high', 'ingest-stall-cron', 'ingest-stall');
END;
$function$;
