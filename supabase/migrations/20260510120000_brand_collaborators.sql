-- Brand Studio: people / collaborator roster.
-- One row per person who contributes creative or production work across Josh's
-- ventures (Adam, Brennan, Dan, Stan, Des, etc.). Multi-venture via text[].
-- Roles are free-form text[] because mixes are unique per person.

create table if not exists public.brand_collaborators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ventures text[] not null default '{}',
  roles text[] not null default '{}',
  skill_level text check (skill_level in ('novice', 'intermediate', 'pro')),
  engagement_status text not null default 'active'
    check (engagement_status in ('active', 'occasional', 'paused', 'past')),
  contact_email text,
  contact_phone text,
  notes text,
  found_via text,
  rate_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_collaborators_ventures_idx
  on public.brand_collaborators using gin (ventures);

create index if not exists brand_collaborators_status_idx
  on public.brand_collaborators (engagement_status);

alter table public.brand_collaborators enable row level security;

create policy "brand_collaborators select all"
  on public.brand_collaborators for select using (true);
create policy "brand_collaborators insert all"
  on public.brand_collaborators for insert with check (true);
create policy "brand_collaborators update all"
  on public.brand_collaborators for update using (true);
create policy "brand_collaborators delete all"
  on public.brand_collaborators for delete using (true);
