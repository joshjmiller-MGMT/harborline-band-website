-- canonical_events — Sub-Plan 03 v2 architecture, Layer 1.
-- One row per real-world event-as-extracted. Multiple input sources (paste,
-- Drive doc/sheet, DJEP scrape, Drive-search hits) MERGE into the same row
-- via the (event_date, normalized_name) unique index — re-ingesting does not
-- create duplicates. Provenance for each source lives inside source_files jsonb.
--
-- This is the canonical-event source-of-truth that all v2 parsers/extractors
-- target. The existing run_of_show table stays as the rendered-output cache
-- queried by availability-checker; Cut 4 will add a canonical_event_id FK to
-- run_of_show so rendered docs can be traced back to their canonical source.

CREATE TABLE public.canonical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity / index columns
  event_date date NOT NULL,
  end_date date,
  name text NOT NULL,
  -- normalized_name = lower(name) with whitespace collapsed + trailing punctuation stripped.
  -- Generated column so the unique index has something stable to bite on.
  normalized_name text GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(lower(trim(name)), '[[:space:]]+', ' ', 'g'),
      '[[:punct:]]+$', '', 'g'
    )
  ) STORED,
  organization text,
  event_type text,
  venue_name text,

  -- Structured event facts (jsonb — mirrors taxonomy v2 CanonicalEvent TS type)
  client jsonb NOT NULL DEFAULT '{}'::jsonb,
  venue jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  guests jsonb NOT NULL DEFAULT '{}'::jsonb,
  attire text,
  logistics jsonb NOT NULL DEFAULT '{}'::jsonb,
  personnel jsonb NOT NULL DEFAULT '[]'::jsonb,
  vendors jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  song_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance — Layer 2 ingestion + Layer 6 Drive-merge story
  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  extractor_version text,
  extracted_at timestamptz NOT NULL DEFAULT now(),

  -- Output tracking — full output rows still live in run_of_show
  last_rendered_at timestamptz,
  last_rendered_outputs text[],

  -- Housekeeping
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX canonical_events_event_date_idx
  ON public.canonical_events (event_date);

-- One canonical row per (date, normalized name). Re-ingestion MERGES.
CREATE UNIQUE INDEX canonical_events_unique_event_idx
  ON public.canonical_events (event_date, normalized_name);

-- Drive integration (Layer 6) needs "which canonical event came from drive_id X?"
CREATE INDEX canonical_events_source_files_gin
  ON public.canonical_events USING GIN (source_files);

ALTER TABLE public.canonical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view canonical_events"
  ON public.canonical_events FOR SELECT USING (true);

CREATE POLICY "Service role can insert canonical_events"
  ON public.canonical_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update canonical_events"
  ON public.canonical_events FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete canonical_events"
  ON public.canonical_events FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.canonical_events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER canonical_events_updated_at
  BEFORE UPDATE ON public.canonical_events
  FOR EACH ROW
  EXECUTE FUNCTION public.canonical_events_set_updated_at();
