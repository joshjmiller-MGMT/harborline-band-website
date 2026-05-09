-- Storage bucket "visual-assets" — public-read (rec #2: signed-URL friction without
-- meaningful protection for band photos), 50MB per-file cap, image MIME types only.
-- Open INSERT/UPDATE/DELETE policies mirror the visual_assets table model: the
-- team-login obstacle is the gate, RLS is open.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visual-assets',
  'visual-assets',
  true,
  52428800,  -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies are scoped to storage.objects.
DROP POLICY IF EXISTS "visual-assets read"   ON storage.objects;
DROP POLICY IF EXISTS "visual-assets insert" ON storage.objects;
DROP POLICY IF EXISTS "visual-assets update" ON storage.objects;
DROP POLICY IF EXISTS "visual-assets delete" ON storage.objects;

CREATE POLICY "visual-assets read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'visual-assets');

CREATE POLICY "visual-assets insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'visual-assets');

CREATE POLICY "visual-assets update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'visual-assets')
  WITH CHECK (bucket_id = 'visual-assets');

CREATE POLICY "visual-assets delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'visual-assets');
