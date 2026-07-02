-- Outreach board: proactive targets to pitch (venues/festivals/radio/playlists/press/collabs).
-- Its own per-domain board (multi-board architecture); seeded from the IG-digest activation.
create table if not exists public.outreach_targets (
  id bigint generated always as identity primary key,
  target text not null,
  type text,
  act text,
  why text,
  next_action text,
  status text not null default 'todo',   -- todo | contacted | in_progress | won | passed
  source text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.outreach_targets enable row level security;
drop policy if exists outreach_targets_auth on public.outreach_targets;
create policy outreach_targets_auth on public.outreach_targets for all to authenticated using (true) with check (true);
