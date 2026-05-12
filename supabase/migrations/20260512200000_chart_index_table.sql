-- chart_index — P14 (Round 2). Sheet-music catalog backed by Google Drive.
-- One row per chart PDF in chart-library/output/. Drive holds the file bytes;
-- this table holds the metadata + search-tsv + Drive pointer so /team/resources
-- (and any future player-tier UI) can search the library without hitting Drive.
--
-- Natural key: (folder_path, filename) — the file's relative location under
-- chart-library/output/. Stable across re-syncs; idempotent on re-runs of the
-- upload-and-index script.

-- IMMUTABLE wrapper so the search_tsv can live in a generated column.
-- Postgres' to_tsvector(text, text) is volatile because the regconfig name is
-- resolved at runtime; the regconfig-typed variant IS immutable, so we cast.
CREATE OR REPLACE FUNCTION public.chart_index_build_tsv(
  p_title text,
  p_composer text,
  p_reference text,
  p_genre text,
  p_setlists text[],
  p_ireal_pro text[],
  p_tags text[],
  p_keywords text,
  p_filename text
) RETURNS tsvector
LANGUAGE sql IMMUTABLE AS $$
  SELECT
    setweight(to_tsvector('english'::regconfig, coalesce(p_title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_composer, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_reference, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_genre, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, array_to_string(coalesce(p_setlists, '{}'::text[]), ' ')), 'B') ||
    setweight(to_tsvector('english'::regconfig, array_to_string(coalesce(p_ireal_pro, '{}'::text[]), ' ')), 'B') ||
    setweight(to_tsvector('english'::regconfig, array_to_string(coalesce(p_tags, '{}'::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_keywords, '')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_filename, '')), 'D')
$$;

CREATE TABLE public.chart_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Filesystem identity (the natural key + the path that survives re-sync)
  folder_path text NOT NULL,
  filename text NOT NULL,
  file_size bigint,
  sha256 text,

  -- Drive pointer (nullable — set after upload; null = not yet pushed or
  -- planned-future metadata-only entry like iReal-Pro-only-no-PDF rows)
  drive_id text,
  drive_web_view_link text,
  drive_account_email text,
  drive_uploaded_at timestamptz,

  -- The 13 metadata.csv columns (post-Phase-6a schema)
  title text NOT NULL,
  composer text,
  genre text,
  tags text[] NOT NULL DEFAULT '{}',
  keywords text,
  rating text,
  difficulty text,
  duration text,
  key_signature text,
  time_signature text,
  reference text,
  setlists text[] NOT NULL DEFAULT '{}',
  ireal_pro text[] NOT NULL DEFAULT '{}',

  -- Audit / traceability
  metadata_csv_row jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Full-text search vector (weighted)
  search_tsv tsvector GENERATED ALWAYS AS (
    public.chart_index_build_tsv(
      title, composer, reference, genre,
      setlists, ireal_pro, tags, keywords, filename
    )
  ) STORED
);

CREATE UNIQUE INDEX chart_index_folder_filename_key
  ON public.chart_index (folder_path, filename);

CREATE UNIQUE INDEX chart_index_drive_id_key
  ON public.chart_index (drive_id)
  WHERE drive_id IS NOT NULL;

CREATE INDEX chart_index_search_tsv_idx
  ON public.chart_index USING GIN (search_tsv);

CREATE INDEX chart_index_folder_path_prefix_idx
  ON public.chart_index (folder_path text_pattern_ops);

CREATE INDEX chart_index_genre_idx ON public.chart_index (genre);
CREATE INDEX chart_index_composer_idx ON public.chart_index (composer);

CREATE OR REPLACE FUNCTION public.chart_index_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER chart_index_set_updated_at
  BEFORE UPDATE ON public.chart_index
  FOR EACH ROW EXECUTE FUNCTION public.chart_index_touch_updated_at();

ALTER TABLE public.chart_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chart_index"
  ON public.chart_index FOR SELECT USING (true);

CREATE POLICY "Service role can insert chart_index"
  ON public.chart_index FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update chart_index"
  ON public.chart_index FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete chart_index"
  ON public.chart_index FOR DELETE USING (true);
