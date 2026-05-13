-- P315 — Practice log redesign: unified practice-items registry + mastery color scale.
--
-- Replaces the song-only `practice_songs` table with a unified `practice_items` table
-- that holds every practiceable artifact (songs, lines, voicings, chords, transcriptions,
-- VAs, devices, technique exercises) under a single roof. Each item carries a
-- `color_level` from the six-color competency ladder Josh uses mentally:
--   1 red    — played once
--   2 orange — practiced through all 12 keys slowly
--   3 yellow — practiced through all 12 keys decently
--   4 green  — practiced through all 12 keys well in both hands
--   5 blue   — used in songs
--   6 purple — fully internalized / memorized
--   0        — unrated (newly added, never touched)
--
-- The recommendation engine reads color + last_practiced_at to surface "what's red and
-- old" first.
--
-- Existing `practice_songs` rows are copied as kind='song' with status mapped to
-- color: 'learned' → 5 (blue), 'learning' → 1 (red), else → 0. The legacy table is
-- left in place so a followup phase can drop it once the new UI is fully proven —
-- no rollback risk in this migration.

CREATE TABLE IF NOT EXISTS public.practice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'song', 'line', 'voicing', 'chord', 'transcription',
    'VA', 'device', 'technique', 'other'
  )),
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  key text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  color_level smallint NOT NULL DEFAULT 0 CHECK (color_level BETWEEN 0 AND 6),
  color_level_updated_at timestamptz,
  last_practiced_at timestamptz,
  times_practiced integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_items_kind_idx
  ON public.practice_items (kind)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS practice_items_recommendation_idx
  ON public.practice_items (color_level, last_practiced_at NULLS FIRST)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS practice_items_title_kind_artist_uniq
  ON public.practice_items (lower(title), kind, lower(artist));

ALTER TABLE public.practice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read practice_items"   ON public.practice_items FOR SELECT USING (true);
CREATE POLICY "Anyone write practice_items"  ON public.practice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update practice_items" ON public.practice_items FOR UPDATE USING (true);
CREATE POLICY "Anyone delete practice_items" ON public.practice_items FOR DELETE USING (true);

CREATE TRIGGER update_practice_items_updated_at
BEFORE UPDATE ON public.practice_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Copy songs over. Idempotent on (lower(title), 'song', lower(artist)) via the unique
-- index above — re-running the migration won't duplicate.
INSERT INTO public.practice_items (
  kind, title, artist, key, notes, color_level, last_practiced_at, times_practiced, created_at, updated_at
)
SELECT
  'song',
  title,
  artist,
  key,
  notes,
  CASE
    WHEN status = 'learned'  THEN 5  -- blue: used in songs / learned
    WHEN status = 'learning' THEN 1  -- red:  played once
    ELSE 0
  END,
  last_practiced_at,
  times_practiced,
  created_at,
  updated_at
FROM public.practice_songs
ON CONFLICT (lower(title), kind, lower(artist)) DO NOTHING;
