-- Release Pipeline: waterfall singles + their prep tasks, for the /team Release Pipeline page.
create table if not exists public.release_singles (
  id bigint generated always as identity primary key,
  single_no int not null,
  working_title text,
  release_date date,
  status text not null default 'planned',   -- planned | scheduled | released
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.release_tasks (
  id bigint generated always as identity primary key,
  single_no int,                            -- null = shared / one-time (EP-wide)
  phase text,
  task text not null,
  status text not null default 'todo',      -- todo | doing | done | skipped
  target_date date,
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.release_singles enable row level security;
alter table public.release_tasks enable row level security;
drop policy if exists release_singles_auth on public.release_singles;
create policy release_singles_auth on public.release_singles for all to authenticated using (true) with check (true);
drop policy if exists release_tasks_auth on public.release_tasks;
create policy release_tasks_auth on public.release_tasks for all to authenticated using (true) with check (true);
