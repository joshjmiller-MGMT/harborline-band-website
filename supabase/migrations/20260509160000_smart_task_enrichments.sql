-- Sub-Plan 02 Feature C: SMART task enrichments
-- Stores raw free-text task input + the structured SMART rewrite Claude returns.
-- Local-Supabase save target chosen as the default (no Monday round-trip);
-- a future migration can add a foreign key if/when we wire write-back.

create table if not exists public.smart_task_enrichments (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  revised_title text,
  definition_of_done text,
  measure text,
  blockers text,
  effort text,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists smart_task_enrichments_created_at_idx
  on public.smart_task_enrichments (created_at desc);

alter table public.smart_task_enrichments enable row level security;

-- Permissive policies match the rest of the team-portal surface
-- (auth is client-side via useTeamAuth; tightening here would lock out the team).
create policy "smart_task_enrichments select all"
  on public.smart_task_enrichments for select using (true);

create policy "smart_task_enrichments insert all"
  on public.smart_task_enrichments for insert with check (true);

create policy "smart_task_enrichments delete all"
  on public.smart_task_enrichments for delete using (true);
