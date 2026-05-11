-- Brand Studio: releases / campaigns timeline.
-- One release belongs to one venture (cross-venture work = two releases). UI
-- in Phase 2; schema lands now so the table is ready when the timeline UI ships.

create table if not exists public.brand_releases (
  id uuid primary key default gen_random_uuid(),
  venture text not null,
  title text not null,
  kind text not null
    check (kind in ('single', 'album', 'ep', 'video', 'campaign', 'other')),
  status text not null default 'planning'
    check (status in ('planning', 'in_production', 'ready', 'released', 'paused', 'cancelled')),
  release_date date,
  notes text,
  blockers text,
  collaborator_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_releases_venture_status_idx
  on public.brand_releases (venture, status);

create index if not exists brand_releases_release_date_idx
  on public.brand_releases (release_date desc nulls last);

alter table public.brand_releases enable row level security;

create policy "brand_releases select all"
  on public.brand_releases for select using (true);
create policy "brand_releases insert all"
  on public.brand_releases for insert with check (true);
create policy "brand_releases update all"
  on public.brand_releases for update using (true);
create policy "brand_releases delete all"
  on public.brand_releases for delete using (true);
