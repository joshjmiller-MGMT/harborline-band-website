
-- Create table for rehearsal responses
CREATE TABLE public.rehearsal_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rehearsal_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (rehearsal_id, option_id, player_name)
);

-- Enable RLS
ALTER TABLE public.rehearsal_responses ENABLE ROW LEVEL SECURITY;

-- Everyone can read all responses
CREATE POLICY "Anyone can view responses"
  ON public.rehearsal_responses FOR SELECT
  USING (true);

-- Anyone can insert responses
CREATE POLICY "Anyone can insert responses"
  ON public.rehearsal_responses FOR INSERT
  WITH CHECK (true);

-- Anyone can update responses
CREATE POLICY "Anyone can update responses"
  ON public.rehearsal_responses FOR UPDATE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_rehearsal_responses_lookup 
  ON public.rehearsal_responses (rehearsal_id, option_id);
