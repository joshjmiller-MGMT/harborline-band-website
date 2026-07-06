-- Systems registry — the single backend touchpoint for EVERYTHING Claude runs.
-- Josh's directive (2026-07-06): "the website backend is the touchpoint for
-- everything. if that doesn't exist for something then make it… I want to manage
-- our workflow for everything." Every system/workstream is catalogued here with
-- what it is, its status, where to interface with it (backend_path), where its
-- knowledge lives (brain_ref), and how it's secured. New systems get registered
-- here so nothing runs invisibly.

create table if not exists public.systems_registry (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,          -- stable slug
  name          text not null,
  category      text not null default 'Other',
  description   text,
  status        text not null default 'active', -- active | in_flight | planned | idea | paused
  backend_path  text,                           -- the /team route to interface with it (null = no surface yet)
  brain_ref     text,                           -- canonical brain doc/path
  health        text,                           -- short current-state note
  security_note text,                           -- how it's gated
  pinned        boolean not null default false,
  sort_order    integer not null default 100,
  last_activity date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_systems_category on public.systems_registry (category);
create index if not exists idx_systems_status   on public.systems_registry (status);

alter table public.systems_registry enable row level security;
create policy "systems_registry select all" on public.systems_registry for select to authenticated using (true);
create policy "systems_registry insert all" on public.systems_registry for insert to authenticated with check (true);
create policy "systems_registry update all" on public.systems_registry for update to authenticated using (true);
create policy "systems_registry delete all" on public.systems_registry for delete to authenticated using (true);
