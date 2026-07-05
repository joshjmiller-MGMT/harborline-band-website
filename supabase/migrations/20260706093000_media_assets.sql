-- Digital Asset Manager — catalogue of all reachable media (photo/video/audio).
-- Slice 1 indexes filesystem metadata only (path, date, type, size, inferred
-- venture/venue) with NO byte reads — so cataloguing 274 GB of gdrive media
-- doesn't download it. EXIF/thumbnails/AI-tagging land later (slice 2), on
-- demand per asset during triage. Files are never moved; this is an index over
-- media in place (Dropbox-central + gdrive mounts).

create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),

  -- Location (the "where is it" the pull-map answers, now per-file).
  full_path     text not null,                 -- absolute path on JARSH; unique key
  source_root   text not null,                 -- which catalogued root it came from
  rel_path      text,                          -- path within source_root
  filename      text not null,
  ext           text,                          -- lowercased, no dot
  media_type    text not null default 'other', -- image | video | audio | other
  location_kind text,                          -- dropbox | gdrive-mydrive | gdrive-shared | physical
  reachable_from text default 'JARSH',         -- JARSH | mac | physical

  -- Filesystem facts (stat only).
  size_bytes    bigint,
  file_mtime    timestamptz,

  -- Inferred at scan time from filename/path (Josh's "YYYY-MM-DD <desc>" convention).
  captured_on   date,                          -- best-effort capture date
  venture       text,                          -- Economy | Harborline | JMJ | Personal | BSE | Brand Studio | Unknown
  venue         text,
  description   text,

  -- Enrichment (slice 2 — populated on demand, null until then).
  content_hash  text,
  exif          jsonb,
  duration_sec  numeric,
  width         integer,
  height        integer,
  ai_caption    text,
  ai_tags       jsonb,
  suggested_output text,                       -- e.g. 'economy-social','harborline-epk','joshjmiller','youtube'
  thumbnail_path text,

  -- Triage state (the joint Josh+Claude management layer).
  status        text not null default 'new',   -- new | keep | routed | archive | junk
  status_note   text,

  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint media_assets_full_path_key unique (full_path)
);

create index if not exists idx_media_assets_venture on public.media_assets (venture);
create index if not exists idx_media_assets_type    on public.media_assets (media_type);
create index if not exists idx_media_assets_captured on public.media_assets (captured_on);
create index if not exists idx_media_assets_status  on public.media_assets (status);

alter table public.media_assets enable row level security;

-- Mirror the /team table convention: authenticated (magic-link) full CRUD;
-- service role (the scanner bulk-load) bypasses RLS inherently.
create policy "media_assets select all" on public.media_assets for select to authenticated using (true);
create policy "media_assets insert all" on public.media_assets for insert to authenticated with check (true);
create policy "media_assets update all" on public.media_assets for update to authenticated using (true);
create policy "media_assets delete all" on public.media_assets for delete to authenticated using (true);
