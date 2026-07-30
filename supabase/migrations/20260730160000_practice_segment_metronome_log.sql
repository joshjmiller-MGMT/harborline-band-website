-- Practice widget: auto-log metronome data per segment.
-- Captures what the metronome was doing while each segment ran; all nullable —
-- segments practiced without the click stay NULL (no placeholder rows).
ALTER TABLE public.practice_session_segments
  ADD COLUMN IF NOT EXISTS metronome_bpm_start integer,
  ADD COLUMN IF NOT EXISTS metronome_bpm_end integer,
  ADD COLUMN IF NOT EXISTS metronome_time_sig text,
  ADD COLUMN IF NOT EXISTS metronome_seconds integer;
