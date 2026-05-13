-- P21 — Visual-asset review queue (Q2 closeout).
-- The tag-visual-asset edge fn now emits a confidence signal per call. Low-confidence
-- suggestions land here instead of getting silently auto-applied / quietly hanging
-- around the grid — Josh sees them as a Review queue at /team/visual-assets and either
-- Applies, Edits & Applies, or Skips. Either action transitions the row to 'reviewed'.
-- Default 'auto' keeps the existing 68 prod assets out of the queue (they pre-date the
-- confidence signal — opting them in retroactively would just be noise).

ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'auto'
  CHECK (review_status IN ('auto', 'needs-review', 'reviewed'));

CREATE INDEX IF NOT EXISTS visual_assets_review_status_idx
  ON public.visual_assets (review_status)
  WHERE review_status = 'needs-review';
