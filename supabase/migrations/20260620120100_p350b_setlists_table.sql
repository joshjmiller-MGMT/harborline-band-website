-- p350b: setlists table — saved setlists for the team setlist builder.
-- Owner-scoped via Supabase Auth (team users have real auth.uid()); written
-- directly by the frontend with the user's JWT, no edge function.

create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text not null check (org in ('bse','harborline','tsb')),
  event_name text,
  event_date date,
  venue text,
  song_ids uuid[] not null default '{}',            -- ordered references into songs.id
  song_snapshot jsonb not null default '[]'::jsonb,  -- point-in-time copy: [{title,artist,genre,functions,decade}] in order
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlists_created_by_idx
  on public.setlists (created_by, updated_at desc);

drop trigger if exists setlists_set_updated_at on public.setlists;
create trigger setlists_set_updated_at before update on public.setlists
  for each row execute function public.tg_touch_updated_at();

alter table public.setlists enable row level security;

drop policy if exists "setlists owner select" on public.setlists;
create policy "setlists owner select" on public.setlists
  for select to authenticated using ((select auth.uid()) = created_by);

drop policy if exists "setlists owner insert" on public.setlists;
create policy "setlists owner insert" on public.setlists
  for insert to authenticated with check ((select auth.uid()) = created_by);

drop policy if exists "setlists owner update" on public.setlists;
create policy "setlists owner update" on public.setlists
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

drop policy if exists "setlists owner delete" on public.setlists;
create policy "setlists owner delete" on public.setlists
  for delete to authenticated using ((select auth.uid()) = created_by);
