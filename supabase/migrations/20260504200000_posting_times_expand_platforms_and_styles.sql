-- Expand posting_times_cache to support YouTube Shorts and per-platform content styles.
-- IG: reels | carousel | story. TikTok + YouTube Shorts: default.

ALTER TABLE public.posting_times_cache
  DROP CONSTRAINT IF EXISTS posting_times_cache_platform_check;

ALTER TABLE public.posting_times_cache
  DROP CONSTRAINT IF EXISTS posting_times_cache_platform_key;

ALTER TABLE public.posting_times_cache
  ADD COLUMN IF NOT EXISTS style text NOT NULL DEFAULT 'default';

ALTER TABLE public.posting_times_cache
  ADD CONSTRAINT posting_times_cache_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'youtube_shorts'));

ALTER TABLE public.posting_times_cache
  ADD CONSTRAINT posting_times_cache_style_check
  CHECK (
    (platform = 'instagram' AND style IN ('reels', 'carousel', 'story'))
    OR (platform IN ('tiktok', 'youtube_shorts') AND style = 'default')
  );

ALTER TABLE public.posting_times_cache
  ADD CONSTRAINT posting_times_cache_platform_style_key UNIQUE (platform, style);

-- Existing rows (instagram/tiktok with style='default') need to be reshaped.
-- Drop any pre-existing instagram default row; widget will repopulate via cron/refresh.
DELETE FROM public.posting_times_cache
  WHERE platform = 'instagram' AND style = 'default';
