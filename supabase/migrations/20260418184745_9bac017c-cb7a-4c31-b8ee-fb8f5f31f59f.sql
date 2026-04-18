
CREATE TABLE public.practice_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'learning',
  notes TEXT NOT NULL DEFAULT '',
  times_practiced INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  learned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX practice_songs_title_artist_uniq
  ON public.practice_songs (lower(title), lower(artist));

ALTER TABLE public.practice_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read practice_songs" ON public.practice_songs FOR SELECT USING (true);
CREATE POLICY "Anyone write practice_songs" ON public.practice_songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update practice_songs" ON public.practice_songs FOR UPDATE USING (true);
CREATE POLICY "Anyone delete practice_songs" ON public.practice_songs FOR DELETE USING (true);

CREATE TRIGGER update_practice_songs_updated_at
BEFORE UPDATE ON public.practice_songs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
