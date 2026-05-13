-- P17: per-event detail-scrape cache. Keyed by DJEP event id (string).
-- Shape: { "<eventId>": { fields: [{label,value}], scrapedAt: ISO, source: "djep-detail" } }
-- Stored alongside the queue-level events array so the hourly queue refresh
-- never clobbers a detail scrape, and the lazy-on-lookup detail-scrape can
-- update one event's entry without rewriting the rest.
ALTER TABLE public.djep_events_cache
  ADD COLUMN IF NOT EXISTS event_details jsonb NOT NULL DEFAULT '{}'::jsonb;
