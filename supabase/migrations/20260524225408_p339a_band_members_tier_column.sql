-- P339a — Add tier column to band_members for public-roster grouping.
--
-- Originally applied directly to prod via Supabase MCP `apply_migration`
-- on 2026-05-24; this file recovers the SQL into the repo so local supabase
-- CLI state matches prod (see brain inbox file
-- `band-members-schema-sync-2026-05-28.md` from Legion for the divergence).
--
-- tier semantics (per HANDOFF-2026-05-25): T1 = core/anchor members
-- surfaced first on /about/the-band; T2 = regular subs surfaced below.
-- NULL = not surfaced publicly. Smallint is intentional — keeps the door
-- open for T3/T4 without an ENUM migration if the roster scheme expands.

ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS tier smallint;
