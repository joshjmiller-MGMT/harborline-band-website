-- visual_assets — canonical archive of every visual asset Josh wants reusable across
-- ventures (Harborline / Economy / JMJ / personal / BSE). Originals + AI-suggested
-- metadata live here; derivative paths fill in once the Phase 2 derivative pipeline
-- ships. Phase 1 = archive surface only (manual upload, manual or AI-assisted tagging).

CREATE TABLE public.visual_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- file identity
  filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,           -- e.g. "shoots/2025-08-pendry/IMG_1234.jpg"
  folder text NOT NULL DEFAULT '',             -- the leading path segments, e.g. "shoots/2025-08-pendry"
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,

  -- editorial metadata (human-approved)
  alt_text text,
  caption text,
  tags text[] NOT NULL DEFAULT '{}',
  ventures text[] NOT NULL DEFAULT '{}',       -- subset of {harborline, economy, jmj, personal, bse}
  rights text NOT NULL DEFAULT 'internal-only', -- internal-only | client-approved | public-ok
  shoot_date date,

  -- AI-suggested metadata (held separately so user can approve/edit)
  ai_suggested_tags text[] NOT NULL DEFAULT '{}',
  ai_suggested_alt text,
  ai_suggested_caption text,
  ai_processed_at timestamptz,
  ai_error text,

  -- derivative pipeline (Phase 2 will populate; nullable for now)
  derivative_paths jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- bookkeeping
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by text,                            -- free-form (no real users yet)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visual_assets_rights_check
    CHECK (rights IN ('internal-only', 'client-approved', 'public-ok'))
);

CREATE INDEX visual_assets_folder_idx       ON public.visual_assets (folder);
CREATE INDEX visual_assets_uploaded_at_idx  ON public.visual_assets (uploaded_at DESC);
CREATE INDEX visual_assets_shoot_date_idx   ON public.visual_assets (shoot_date DESC);
CREATE INDEX visual_assets_tags_gin_idx     ON public.visual_assets USING GIN (tags);
CREATE INDEX visual_assets_ventures_gin_idx ON public.visual_assets USING GIN (ventures);

ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;

-- Mirror practice_sessions / songs / etc.: the team-login obstacle is the gate; RLS is open.
CREATE POLICY "Anyone read visual_assets"   ON public.visual_assets FOR SELECT USING (true);
CREATE POLICY "Anyone insert visual_assets" ON public.visual_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update visual_assets" ON public.visual_assets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone delete visual_assets" ON public.visual_assets FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.visual_assets_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER visual_assets_updated_at
  BEFORE UPDATE ON public.visual_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.visual_assets_set_updated_at();
