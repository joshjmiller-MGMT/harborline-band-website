-- P310 — Band-member roster for face recognition in the visual-asset tagger.
--
-- Q5 resolved (2026-05-13): new band_members table, NOT extension of
-- brand_collaborators. Brand Studio People = creative-collaborator roster
-- (different role-shape, different governance — see
-- `reference_brand_studio_people.md`). Band-members = performers Josh wants
-- the tagger to identify by name; an Adam in brand_collaborators is not the
-- same Adam who plays in the band, and conflating them mis-tags photos.
--
-- Each member needs ≥1 reference image in storage at
-- `visual-assets/reference-faces/<band_member_id>.jpg`. The
-- `tag-visual-asset` edge fn loads `active=true AND reference_image_path
-- IS NOT NULL` rows and passes them to Claude as a `<people>` block; the
-- model populates `people_names` strictly from the supplied roster (never
-- free-text).
--
-- Post-P319 hygiene: RLS-on, no anon policies. Writes go through the
-- /team/band-members UI which writes via supabase-js with the operator's
-- JWT — gated by an authenticated-only INSERT/UPDATE/DELETE policy. Reads
-- are operator-only too (no public/anon path needed; the tagger uses
-- service-role).

CREATE TABLE public.band_members (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  role                   text NOT NULL,
  reference_image_path   text,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_band_members_active_with_ref
  ON public.band_members (active)
  WHERE active = true AND reference_image_path IS NOT NULL;

ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the roster (operator-only client at /team/*;
-- player-tier doesn't load this page). Service-role bypasses RLS, so the
-- tagger edge fn keeps working unchanged.
CREATE POLICY "band_members read for authenticated"
  ON public.band_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "band_members insert for authenticated"
  ON public.band_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "band_members update for authenticated"
  ON public.band_members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "band_members delete for authenticated"
  ON public.band_members
  FOR DELETE
  TO authenticated
  USING (true);

-- Add ai_suggested_people_names to visual_assets so the tagger's named-people
-- output has a dedicated column. Empty array default mirrors the existing
-- ai_suggested_people_roles + ai_suggested_instruments shape.
ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS ai_suggested_people_names text[] NOT NULL DEFAULT '{}';
