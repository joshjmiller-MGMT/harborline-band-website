
-- Presets (Long / Medium / Quick / custom)
CREATE TABLE public.practice_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_minutes integer NOT NULL DEFAULT 60,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.practice_preset_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.practice_presets(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL DEFAULT '',
  target_minutes integer NOT NULL DEFAULT 10,
  bpm integer,
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_preset_segments_preset ON public.practice_preset_segments(preset_id, sort_order);

-- Sessions
CREATE TABLE public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid REFERENCES public.practice_presets(id) ON DELETE SET NULL,
  preset_name text NOT NULL DEFAULT '',
  song_of_the_day text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_started ON public.practice_sessions(started_at DESC);

CREATE TABLE public.practice_session_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL DEFAULT '',
  target_minutes integer NOT NULL DEFAULT 0,
  actual_seconds integer NOT NULL DEFAULT 0,
  bpm integer,
  notes text NOT NULL DEFAULT '',
  what_practiced text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_segments_session ON public.practice_session_segments(session_id, sort_order);

-- RLS (open like the rest of the team-portal tables)
ALTER TABLE public.practice_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_preset_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_session_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read practice_presets" ON public.practice_presets FOR SELECT USING (true);
CREATE POLICY "Anyone write practice_presets" ON public.practice_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update practice_presets" ON public.practice_presets FOR UPDATE USING (true);
CREATE POLICY "Anyone delete practice_presets" ON public.practice_presets FOR DELETE USING (true);

CREATE POLICY "Anyone read preset_segments" ON public.practice_preset_segments FOR SELECT USING (true);
CREATE POLICY "Anyone write preset_segments" ON public.practice_preset_segments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update preset_segments" ON public.practice_preset_segments FOR UPDATE USING (true);
CREATE POLICY "Anyone delete preset_segments" ON public.practice_preset_segments FOR DELETE USING (true);

CREATE POLICY "Anyone read sessions" ON public.practice_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone write sessions" ON public.practice_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update sessions" ON public.practice_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone delete sessions" ON public.practice_sessions FOR DELETE USING (true);

CREATE POLICY "Anyone read session_segments" ON public.practice_session_segments FOR SELECT USING (true);
CREATE POLICY "Anyone write session_segments" ON public.practice_session_segments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update session_segments" ON public.practice_session_segments FOR UPDATE USING (true);
CREATE POLICY "Anyone delete session_segments" ON public.practice_session_segments FOR DELETE USING (true);

CREATE TRIGGER practice_presets_updated BEFORE UPDATE ON public.practice_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER practice_preset_segments_updated BEFORE UPDATE ON public.practice_preset_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER practice_sessions_updated BEFORE UPDATE ON public.practice_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed presets
DO $$
DECLARE
  long_id uuid := gen_random_uuid();
  med_id uuid := gen_random_uuid();
  quick_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.practice_presets (id, name, description, target_minutes, sort_order, is_default) VALUES
    (long_id, 'Long Session', 'Full 2-hour deep practice', 120, 0, true),
    (med_id, 'Medium Session', 'Balanced 1-hour routine', 60, 1, false),
    (quick_id, 'Quick Session', '20-minute warmup / maintenance', 20, 2, false);

  -- Long: based on full column structure from the sheet
  INSERT INTO public.practice_preset_segments (preset_id, category, label, target_minutes, sort_order) VALUES
    (long_id, 'Chords', 'Chords (voicings, drops)', 15, 0),
    (long_id, 'Scales', 'Scales (8s/10s/6s)', 15, 1),
    (long_id, 'Technical', 'Technical', 15, 2),
    (long_id, 'Patterns', 'Patterns', 15, 3),
    (long_id, 'Lines', 'Lines (RH/LH)', 20, 4),
    (long_id, 'Songs', 'Songs', 25, 5),
    (long_id, 'Transcriptions', 'Transcriptions', 10, 6),
    (long_id, 'Arrangements', 'Arrangements', 5, 7);

  -- Medium: tightened core
  INSERT INTO public.practice_preset_segments (preset_id, category, label, target_minutes, sort_order) VALUES
    (med_id, 'Chords', 'Chords', 10, 0),
    (med_id, 'Scales', 'Scales', 10, 1),
    (med_id, 'Lines', 'Lines', 15, 2),
    (med_id, 'Songs', 'Songs', 20, 3),
    (med_id, 'Original', 'Original / Free play', 5, 4);

  -- Quick: warmup
  INSERT INTO public.practice_preset_segments (preset_id, category, label, target_minutes, sort_order) VALUES
    (quick_id, 'Scales', 'Scale warmup', 5, 0),
    (quick_id, 'Lines', 'Line of the day', 5, 1),
    (quick_id, 'Songs', 'Song of the day', 10, 2);
END $$;
