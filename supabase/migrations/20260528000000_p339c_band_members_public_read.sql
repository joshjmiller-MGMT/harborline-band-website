-- P339c — Add anon SELECT policy to band_members for /about/the-band public roster.
--
-- Locked 2026-05-28: tiered + active = public. Members with tier IS NULL
-- remain operator-only (the original P310 default). reference_image_path
-- exposed alongside other columns is harmless — it's just a Storage path;
-- the bytes themselves are gated by visual-assets Storage RLS.

CREATE POLICY "band_members public read"
  ON public.band_members
  FOR SELECT
  TO anon
  USING (active = true AND tier IS NOT NULL);
