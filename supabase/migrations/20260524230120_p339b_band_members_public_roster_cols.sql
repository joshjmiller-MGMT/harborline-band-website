-- P339b — Add public-roster columns to band_members for /about/the-band.
--
-- Originally applied directly to prod via Supabase MCP `apply_migration`
-- on 2026-05-24; this file recovers the SQL into the repo so local supabase
-- CLI state matches prod (see brain inbox file
-- `band-members-schema-sync-2026-05-28.md` from Legion for the divergence).
--
-- These three columns power the public-facing roster card on
-- /about/the-band: a member-supplied bio_short, a public-safe headshot
-- (separate from reference_image_path, which is the AI-tagger reference
-- and may not be presentation-grade), and an Instagram handle for the
-- per-member social link. All nullable — a member can be public-listed
-- (tier IS NOT NULL) before all fields are filled in.

ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS headshot_url     text,
  ADD COLUMN IF NOT EXISTS bio_short        text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;
