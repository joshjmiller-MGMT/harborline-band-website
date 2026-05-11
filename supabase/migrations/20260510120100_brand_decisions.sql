-- Brand Studio: decisions log.
-- Captures brand/identity/voice/strategy decisions per venture so Adam, Josh,
-- and future collaborators can see why a choice was made — not just the asset.
-- supersedes via superseded_by (preserves history, no destructive edits).

create table if not exists public.brand_decisions (
  id uuid primary key default gen_random_uuid(),
  ventures text[] not null default '{}',
  title text not null,
  decision text not null,
  rationale text,
  decided_at date not null default current_date,
  decided_by text,
  related_assets uuid[],
  superseded_by uuid references public.brand_decisions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists brand_decisions_ventures_idx
  on public.brand_decisions using gin (ventures);

create index if not exists brand_decisions_active_idx
  on public.brand_decisions (decided_at desc)
  where superseded_by is null;

alter table public.brand_decisions enable row level security;

create policy "brand_decisions select all"
  on public.brand_decisions for select using (true);
create policy "brand_decisions insert all"
  on public.brand_decisions for insert with check (true);
create policy "brand_decisions update all"
  on public.brand_decisions for update using (true);
create policy "brand_decisions delete all"
  on public.brand_decisions for delete using (true);
