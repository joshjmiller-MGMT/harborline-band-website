-- p344a — Life-Data Archive: core schema
--
-- Phase 1 foundation for p344 (life-data archive tab). Three tables:
--   archive_events       — one canonical row per discrete life-data event
--                          (photo, calendar event, brain page, practice session, etc.)
--   archive_tags         — taxonomy of tags (hybrid seed + organic per Josh 2026-05-29 #4)
--   archive_event_tags   — many-to-many join with confidence + inferred_by provenance
--
-- Scope: operator-only access. Per Josh 2026-05-29 (p344 §5 answer #6) no per-source
-- privacy classifications — single ADMIN-tier view. Future role-split (ADMIN vs
-- teammate-with-menu-scoped-access) is a separate plan doc.
--
-- RLS strategy: enable on all 3 tables with NO policies. Effectively deny-all to
-- anon + authenticated; service_role bypasses RLS by design. All reads/writes
-- go through edge fns (which apply require-operator gating) or direct
-- service-role SQL (Supabase MCP execute_sql, internal scripts, cron). Matches
-- the pattern in trello-route-cards + djep-calendar-events + staffing-snapshot.
--
-- Sources expected to write into archive_events (from p344 + photo-canonical-map):
--   apple_photos · google_calendar · physical_scan · jjmm · practice_log
--   brain_page · setlists · hardware_asset · old_laptop_archive · dropbox_event_folder
--
-- Cross-source dedup contract (NOT this migration — separate later pass):
--   Same underlying photo surfaced via two sources writes TWO rows preserving
--   provenance. archive_event_dedup_groups (future table) groups them via
--   content_hash. See [photo-canonical-map.md] § "Dedup contract for the archive".

-- =============================================================================
-- archive_events
-- =============================================================================

CREATE TABLE public.archive_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  source_id       text NOT NULL,
  occurred_at     timestamptz NOT NULL,
  occurred_end    timestamptz,
  location_name   text,
  location_lat    double precision,
  location_lng    double precision,
  summary         text,
  raw_metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT archive_events_source_id_unique UNIQUE (source, source_id),
  CONSTRAINT archive_events_latlng_paired CHECK (
    (location_lat IS NULL AND location_lng IS NULL) OR
    (location_lat IS NOT NULL AND location_lng IS NOT NULL)
  )
);

COMMENT ON TABLE  public.archive_events IS 'p344 — One canonical row per discrete life-data event. Source = ingestion origin (apple_photos, google_calendar, etc.); source_id = stable identifier in that source. occurred_at = best capture/start timestamp.';
COMMENT ON COLUMN public.archive_events.source        IS 'Ingestion source identifier. Values from a controlled vocabulary; see p344 memo for the list.';
COMMENT ON COLUMN public.archive_events.source_id     IS 'Stable ID within the source. Photo UUID, calendar event ID, brain page path, etc.';
COMMENT ON COLUMN public.archive_events.occurred_at   IS 'Best-guess capture/start timestamp. From EXIF DateTimeOriginal, calendar event start, log date, etc. NOT created_at (the ingest insert time).';
COMMENT ON COLUMN public.archive_events.occurred_end  IS 'Optional end timestamp for ranges (calendar event end, multi-day archive entries).';
COMMENT ON COLUMN public.archive_events.location_name IS 'Human-readable place name (venue, city, address). May be NULL if no place data available.';
COMMENT ON COLUMN public.archive_events.location_lat  IS 'Latitude. Paired with location_lng via CHECK constraint. NULL when no GPS data (e.g. Apple Photos -180.0 sentinel translates to NULL on ingest).';
COMMENT ON COLUMN public.archive_events.location_lng  IS 'Longitude. Paired with location_lat.';
COMMENT ON COLUMN public.archive_events.summary       IS 'Short human-readable summary. NULL OK; downstream can fall back to derived summaries.';
COMMENT ON COLUMN public.archive_events.raw_metadata  IS 'JSON blob with all source-specific fields preserved verbatim. EXIF dict, calendar attendees, brain page frontmatter, etc. Queryable via JSONB ops; load-bearing fields get promoted to typed columns as needed.';

-- Indexes for the dominant query patterns:
--   "events from year Y" → occurred_at range scan
--   "events from source S" → source equality scan
--   "events near location X" → location_name full-text + location_lat/lng later (PostGIS deferred)
--   "events with field F in raw_metadata" → JSONB GIN
--
-- The unique constraint on (source, source_id) automatically gets a btree index.
CREATE INDEX archive_events_occurred_at_idx     ON public.archive_events (occurred_at DESC);
CREATE INDEX archive_events_source_idx          ON public.archive_events (source);
CREATE INDEX archive_events_location_name_idx   ON public.archive_events USING gin (to_tsvector('english', coalesce(location_name, '')));
CREATE INDEX archive_events_raw_metadata_gin_idx ON public.archive_events USING gin (raw_metadata);

-- updated_at maintenance via existing pattern (other tables in this repo
-- use a trigger function `update_updated_at_column` — reuse if it exists,
-- otherwise inline the logic here).
CREATE OR REPLACE FUNCTION public.archive_events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER archive_events_updated_at
BEFORE UPDATE ON public.archive_events
FOR EACH ROW
EXECUTE FUNCTION public.archive_events_set_updated_at();

-- =============================================================================
-- archive_tags
-- =============================================================================

CREATE TABLE public.archive_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  kind        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.archive_tags IS 'p344 — Tag taxonomy. Hybrid seed (from brain entities/concepts: ventures, people, venues, instruments, event-types) + organic growth (free tags emerging from real content).';
COMMENT ON COLUMN public.archive_tags.name        IS 'Canonical tag name. Lowercase-recommended for consistency but not enforced. Examples: "harborline", "sean-sidley", "iphone-15", "wedding", "studio-session", "backwater-books".';
COMMENT ON COLUMN public.archive_tags.kind        IS 'Tag category. Suggested values: "venture", "person", "venue", "instrument", "event-type", "place", "free". Used for UI filtering + tag-creation policies.';
COMMENT ON COLUMN public.archive_tags.description IS 'Optional one-liner explaining what the tag covers. Useful for ambiguous or compound tags.';

CREATE INDEX archive_tags_kind_idx ON public.archive_tags (kind);

-- =============================================================================
-- archive_event_tags (M2M)
-- =============================================================================

CREATE TABLE public.archive_event_tags (
  event_id     uuid NOT NULL REFERENCES public.archive_events (id) ON DELETE CASCADE,
  tag_id       uuid NOT NULL REFERENCES public.archive_tags (id) ON DELETE CASCADE,
  confidence   smallint NOT NULL DEFAULT 100,
  inferred_by  text NOT NULL DEFAULT 'manual',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, tag_id),
  CONSTRAINT archive_event_tags_confidence_range CHECK (confidence >= 0 AND confidence <= 100)
);

COMMENT ON TABLE  public.archive_event_tags IS 'p344 — Many-to-many event ↔ tag relationship with confidence + provenance.';
COMMENT ON COLUMN public.archive_event_tags.confidence  IS '0-100. 100 = manual / certain. Lower = inferred from heuristic. UI may filter on confidence threshold.';
COMMENT ON COLUMN public.archive_event_tags.inferred_by IS 'How the tag was applied. Examples: "manual", "exif_gps_to_venue", "calendar_attendee_match", "claude_vision_ocr", "filename_keyword".';

CREATE INDEX archive_event_tags_tag_idx ON public.archive_event_tags (tag_id);

-- =============================================================================
-- RLS
-- =============================================================================
--
-- Enable on all 3 tables with NO policies. This denies access to anon +
-- authenticated roles. Service-role (used by edge fns + Supabase MCP +
-- internal scripts) bypasses RLS — that's the access path.
--
-- Future expansion (Phase 2 UI): if /team/archive needs direct from-browser
-- reads, add SELECT policy gated on auth.uid() ∈ operator user IDs. For now
-- keep deny-all to enforce single-channel access through edge fns.

ALTER TABLE public.archive_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_event_tags ENABLE ROW LEVEL SECURITY;
