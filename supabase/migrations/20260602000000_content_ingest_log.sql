create table if not exists public.content_ingest_log (
  id uuid primary key default gen_random_uuid(),
  shortcode text not null unique, platform text not null default 'instagram',
  source_account text, collection_name text, url text not null, uploader text,
  caption text, transcript text, duration_sec numeric,
  purpose text, confidence numeric, summary text, application text, venture text,
  action text, route text, tags text[] not null default '{}',
  status text not null default 'ingested', routed_ref text,
  ingested_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists idx_content_ingest_log_account on public.content_ingest_log (source_account);
create index if not exists idx_content_ingest_log_purpose on public.content_ingest_log (purpose);
create index if not exists idx_content_ingest_log_ingested on public.content_ingest_log (ingested_at desc);
alter table public.content_ingest_log enable row level security;
