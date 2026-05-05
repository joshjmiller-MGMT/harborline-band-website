-- Append-only log of raw scrapes that feed the posting-times synthesis.
-- 30-day retention via a periodic cleanup (called by the same cron entry that runs the refresh).

CREATE TABLE public.posting_times_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  source_label text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube_shorts', 'general')),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  raw_markdown text NOT NULL,
  scrape_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posting_times_sources_scraped_at_idx
  ON public.posting_times_sources (scraped_at DESC);

CREATE INDEX posting_times_sources_platform_idx
  ON public.posting_times_sources (platform, scraped_at DESC);

ALTER TABLE public.posting_times_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posting_times_sources"
  ON public.posting_times_sources FOR SELECT USING (true);

CREATE POLICY "Service role can insert posting_times_sources"
  ON public.posting_times_sources FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can delete posting_times_sources"
  ON public.posting_times_sources FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_old_posting_times_sources()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.posting_times_sources
    WHERE scraped_at < now() - INTERVAL '30 days';
$$;
