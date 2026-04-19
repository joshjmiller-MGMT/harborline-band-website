CREATE TABLE public.availability_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL UNIQUE,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_cache_date ON public.availability_cache(date);
CREATE INDEX idx_availability_cache_expires ON public.availability_cache(expires_at);

ALTER TABLE public.availability_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability_cache"
ON public.availability_cache FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert availability_cache"
ON public.availability_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update availability_cache"
ON public.availability_cache FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete availability_cache"
ON public.availability_cache FOR DELETE
USING (true);

CREATE TRIGGER update_availability_cache_updated_at
BEFORE UPDATE ON public.availability_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();