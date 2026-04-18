CREATE TABLE public.djep_events_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.djep_events_cache ENABLE ROW LEVEL SECURITY;

-- No public policies: only the service role (used by edge functions) can read/write.
CREATE INDEX idx_djep_events_cache_key ON public.djep_events_cache(cache_key);

CREATE TRIGGER update_djep_events_cache_updated_at
BEFORE UPDATE ON public.djep_events_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();