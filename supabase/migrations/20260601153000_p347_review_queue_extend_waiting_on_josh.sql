-- P347: Extend waiting_on_josh into a richer review queue + add review-media Storage bucket.
--
-- Why extend rather than create a new table: the existing waiting_on_josh + WaitingOnJoshWidget
-- already model "things blocking on Josh." Forking into a parallel review_items table would
-- fragment the queue and orphan the dashboard widget. Adding nullable columns + an item_type
-- discriminator keeps the dashboard widget working while enabling the richer /team/review surface.

ALTER TABLE public.waiting_on_josh
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'general'
    CHECK (item_type IN ('general', 'sidecar_classification', 'brand_voice', 'visual_review', 'decision')),
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS context_md text,
  ADD COLUMN IF NOT EXISTS media_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS triangulation_loops jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_ref text;

-- Index by type for queue filtering.
CREATE INDEX IF NOT EXISTS waiting_on_josh_item_type_idx
  ON public.waiting_on_josh (item_type, queued_at DESC)
  WHERE resolved_at IS NULL;

-- Storage bucket review-media: PRIVATE (signed URLs only) — review items can include
-- private client gig content. Different from visual-assets (public band photos).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-media',
  'review-media',
  false,
  104857600,  -- 100 MB cap (preview clips + image grabs only; master files stay in Dropbox)
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Operator-gated storage policies (mirror visual-assets shape, but require auth).
DROP POLICY IF EXISTS "review-media read"   ON storage.objects;
DROP POLICY IF EXISTS "review-media insert" ON storage.objects;
DROP POLICY IF EXISTS "review-media update" ON storage.objects;
DROP POLICY IF EXISTS "review-media delete" ON storage.objects;

CREATE POLICY "review-media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-media' AND auth.role() = 'authenticated');

CREATE POLICY "review-media insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-media' AND auth.role() = 'authenticated');

CREATE POLICY "review-media update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'review-media' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'review-media' AND auth.role() = 'authenticated');

CREATE POLICY "review-media delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-media' AND auth.role() = 'authenticated');

COMMENT ON COLUMN public.waiting_on_josh.item_type IS 'P347: queue discriminator — drives /team/review UI shape per type';
COMMENT ON COLUMN public.waiting_on_josh.prompt IS 'P347: one-sentence question to Josh (separate from title, which is the heading)';
COMMENT ON COLUMN public.waiting_on_josh.context_md IS 'P347: markdown context — what we know, what we inferred, why we are blocked';
COMMENT ON COLUMN public.waiting_on_josh.media_refs IS 'P347: array of {kind: image|video|screenshot, storage_path: review-media/X, label: text}';
COMMENT ON COLUMN public.waiting_on_josh.triangulation_loops IS 'P347: array of {label, description} — Claude-runnable loops to help Josh resolve';
COMMENT ON COLUMN public.waiting_on_josh.source_ref IS 'P347: round-trip pointer (e.g. wiki/meta/needs-josh.md § 2026-04-11) for write-back on resolve';
