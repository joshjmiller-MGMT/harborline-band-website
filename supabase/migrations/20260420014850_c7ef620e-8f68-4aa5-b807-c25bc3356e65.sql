ALTER TABLE public.booking_agent_config
ADD COLUMN IF NOT EXISTS venue_tab_gid text NOT NULL DEFAULT '';