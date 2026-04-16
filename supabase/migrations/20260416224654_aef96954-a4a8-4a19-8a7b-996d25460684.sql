-- Google Calendar OAuth tokens (single-user, but support multiple rows just in case)
CREATE TABLE public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view google tokens"
  ON public.google_calendar_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can insert google tokens"
  ON public.google_calendar_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update google tokens"
  ON public.google_calendar_tokens FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete google tokens"
  ON public.google_calendar_tokens FOR DELETE USING (true);

-- Monday.com calendar source configs
CREATE TABLE public.monday_calendar_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id TEXT NOT NULL,
  date_column_id TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monday_calendar_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view monday sources"
  ON public.monday_calendar_sources FOR SELECT USING (true);
CREATE POLICY "Anyone can insert monday sources"
  ON public.monday_calendar_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update monday sources"
  ON public.monday_calendar_sources FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete monday sources"
  ON public.monday_calendar_sources FOR DELETE USING (true);

-- Reusable updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monday_calendar_sources_updated_at
  BEFORE UPDATE ON public.monday_calendar_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();