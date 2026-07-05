-- Folder-context layer of the DAM. Josh's methodology: every folder carries a
-- complete-context file describing what it is + next actions — the same pattern
-- the brain uses (index.md per domain). This table is the canonical source of
-- truth; a human-browsable `_FOLDER-CONTEXT.md` sidecar is mirrored into each
-- folder (write-through cache, like the brain ↔ auto-memory mirror).
--
-- Classification (why Josh took/kept the media):
--   event      — a group of media from one occasion (gig/wedding/rehearsal/hang);
--                personal or professional. The one that flows to the pro pipeline.
--   session    — audio-dominant folder (rehearsal/recording takes).
--   reference  — produced assets (logos, brand/EPK images, design files).
--   knowledge  — capture-to-remember (screenshots, whiteboards, docs, gear labels).
--   mixed / other.

create table if not exists public.media_folders (
  id            uuid primary key default gen_random_uuid(),
  folder_path   text not null,
  name          text not null,
  source_root   text,

  file_count    integer not null default 0,
  image_count   integer not null default 0,
  video_count   integer not null default 0,
  audio_count   integer not null default 0,
  total_bytes   bigint  not null default 0,

  date_min      date,
  date_max      date,
  top_venture   text,
  ventures      text[],

  folder_class  text not null default 'other',   -- event|session|reference|knowledge|mixed|other
  sphere        text,                             -- personal|professional|unknown
  event_name    text,
  event_date    date,

  context_md    text,                             -- generated folder-context body
  sidecar_path  text,
  sidecar_written_at timestamptz,

  -- Event → edit → schedule pipeline state.
  status        text not null default 'catalogued', -- catalogued|organized|ported|editing|scheduled|done
  editor        text,
  status_note   text,

  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint media_folders_folder_path_key unique (folder_path)
);

create index if not exists idx_media_folders_class   on public.media_folders (folder_class);
create index if not exists idx_media_folders_venture on public.media_folders (top_venture);
create index if not exists idx_media_folders_status  on public.media_folders (status);
create index if not exists idx_media_folders_evdate  on public.media_folders (event_date);

alter table public.media_folders enable row level security;
create policy "media_folders select all" on public.media_folders for select to authenticated using (true);
create policy "media_folders insert all" on public.media_folders for insert to authenticated with check (true);
create policy "media_folders update all" on public.media_folders for update to authenticated using (true);
create policy "media_folders delete all" on public.media_folders for delete to authenticated using (true);
