-- P333 — Song-list generator backing store.
--
-- `setlist_builds` holds the resolver output from /team/setlist-builder:
-- one row per "raw song list → matched/unmatched chart manifest" request.
-- The web UI POSTs a raw list + event metadata; the `setlist-resolve` edge fn
-- fuzzy-matches each line against `chart_index` and persists the manifest here.
-- A local Python CLI (`phase7_stage_setlist.py --from-manifest <id>`) then
-- fetches the manifest and materializes the gig folder on Josh's Mac under
-- `~/Dropbox/forScore-import/<gig-slug>/`, marking the row materialized.
--
-- Edge fns can't write Josh's local filesystem; that's why this is a
-- two-step web-resolve + local-materialize split, not a single backend op.

create table if not exists public.setlist_builds (
  id uuid primary key default gen_random_uuid(),
  gig_slug text not null,
  event_name text not null,
  event_date date,
  venue text,
  raw_input text not null,
  manifest jsonb not null,
  status text not null default 'queued'
    check (status in ('queued', 'materialized', 'failed')),
  materialized_at timestamptz,
  materialized_path text,
  materialized_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists setlist_builds_created_at_idx
  on public.setlist_builds (created_at desc);

create index if not exists setlist_builds_gig_slug_idx
  on public.setlist_builds (gig_slug);

create index if not exists setlist_builds_status_idx
  on public.setlist_builds (status)
  where status = 'queued';

alter table public.setlist_builds enable row level security;

-- No anon/authenticated policies — all reads/writes go through the
-- requireOperator()-gated edge fn using the service role.

create or replace function public.setlist_builds_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists setlist_builds_updated_at on public.setlist_builds;
create trigger setlist_builds_updated_at
  before update on public.setlist_builds
  for each row execute function public.setlist_builds_set_updated_at();
