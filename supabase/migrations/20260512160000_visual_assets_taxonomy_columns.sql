-- P9 — Expanded AI-suggested taxonomy on visual_assets.
-- The tag-visual-asset edge function now returns structured fields (kind, people roles,
-- people count, venue, instruments, location) in addition to the existing tags / alt / caption.
-- These mirror the existing ai_suggested_* pattern: AI fills them, the user reviews and applies
-- (the per-row "Apply" button folds them back into the tags array with prefix convention so
-- the existing search + filter UI keeps working unchanged).
--
-- Naming: kept verbose ai_suggested_* prefix to match the existing 4 columns. Easy to scan.

ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS ai_suggested_kind text,
  ADD COLUMN IF NOT EXISTS ai_suggested_people_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_suggested_people_count text,
  ADD COLUMN IF NOT EXISTS ai_suggested_venue text,
  ADD COLUMN IF NOT EXISTS ai_suggested_instruments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_suggested_location text;
