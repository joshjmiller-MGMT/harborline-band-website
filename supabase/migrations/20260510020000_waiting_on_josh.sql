-- Sub-Plan 02 Feature D: "Waiting on Josh" alerts panel
-- Centralized docket for work blocked on Josh's input. Other Claude / Cowork
-- sessions INSERT a row when they hit a fork they need Josh on; the dashboard
-- widget shows unresolved rows; Josh resolves via button.

create table if not exists public.waiting_on_josh (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  source_session text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  queued_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text
);

create index if not exists waiting_on_josh_unresolved_idx
  on public.waiting_on_josh (queued_at desc)
  where resolved_at is null;

create index if not exists waiting_on_josh_priority_idx
  on public.waiting_on_josh (priority, queued_at desc)
  where resolved_at is null;

alter table public.waiting_on_josh enable row level security;

create policy "waiting_on_josh select all"
  on public.waiting_on_josh for select using (true);

create policy "waiting_on_josh insert all"
  on public.waiting_on_josh for insert with check (true);

create policy "waiting_on_josh update all"
  on public.waiting_on_josh for update using (true);

create policy "waiting_on_josh delete all"
  on public.waiting_on_josh for delete using (true);
