CREATE TABLE public.claude_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  machine TEXT NOT NULL DEFAULT 'Unknown Machine',
  context TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  next_steps TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.claude_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view claude log" ON public.claude_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert claude log" ON public.claude_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete claude log" ON public.claude_log FOR DELETE USING (true);

CREATE INDEX idx_claude_log_timestamp ON public.claude_log (timestamp DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.claude_log;