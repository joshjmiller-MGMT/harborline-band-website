CREATE TABLE public.posting_times_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE CHECK (platform IN ('instagram','tiktok')),
  heatmap jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_note text NOT NULL DEFAULT '',
  sources text[] NOT NULL DEFAULT '{}',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.posting_times_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posting_times_cache" ON public.posting_times_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert posting_times_cache" ON public.posting_times_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update posting_times_cache" ON public.posting_times_cache FOR UPDATE USING (true);

CREATE TRIGGER posting_times_cache_updated_at
BEFORE UPDATE ON public.posting_times_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();