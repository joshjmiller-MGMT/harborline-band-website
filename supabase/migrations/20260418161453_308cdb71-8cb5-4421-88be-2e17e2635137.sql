CREATE TABLE IF NOT EXISTS public.booking_agent_config (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT true,
  sheet_id text NOT NULL DEFAULT '',
  tab_gid text NOT NULL DEFAULT '',
  sheet_url text NOT NULL DEFAULT '',
  status_col text NOT NULL DEFAULT '',
  name_col text NOT NULL DEFAULT '',
  next_followup_col text NOT NULL DEFAULT '',
  last_contact_col text NOT NULL DEFAULT '',
  notes_col text NOT NULL DEFAULT '',
  link_col text NOT NULL DEFAULT '',
  type_col text NOT NULL DEFAULT '',
  reachout_values text NOT NULL DEFAULT '',
  followup_values text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#f59e0b',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view booking_agent_config"
  ON public.booking_agent_config FOR SELECT USING (true);
CREATE POLICY "Anyone can insert booking_agent_config"
  ON public.booking_agent_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update booking_agent_config"
  ON public.booking_agent_config FOR UPDATE USING (true);

INSERT INTO public.booking_agent_config (id, sheet_id, sheet_url)
VALUES ('default', '1ljSJ-58WqTJP0zK9RiNAtsEG3BYW-L0Mpb1PgGi7b4g',
  'https://docs.google.com/spreadsheets/d/1ljSJ-58WqTJP0zK9RiNAtsEG3BYW-L0Mpb1PgGi7b4g/edit')
ON CONFLICT (id) DO NOTHING;