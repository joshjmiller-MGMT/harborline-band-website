-- AI Teammates (Josh 2026-07-12): a chat-managed expert agent per field,
-- surfaced on /team/members. Josh gives jobs in a per-agent chat; agents carry
-- them out (chat replies via the agent-chat edge fn; heavy jobs executed by the
-- orchestrator session as the persona). Each agent shows its current action and
-- keeps an individual history so Josh can re-acclimate per field.
create table public.agent_teammates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  field text not null,
  emoji text not null default '🤖',
  color text not null default '#888888',
  tagline text not null default '',
  system_prompt text not null,
  charter_ref text,
  status text not null default 'idle'
    check (status in ('idle','working','waiting_on_josh')),
  current_action text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_teammates(id) on delete cascade,
  title text not null,
  instruction text not null,
  status text not null default 'queued'
    check (status in ('queued','in_progress','done','blocked','cancelled')),
  result_md text,
  blocked_reason text,
  created_by text not null default 'josh',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index agent_jobs_agent_created_idx on public.agent_jobs (agent_id, created_at desc);
create index agent_jobs_status_idx on public.agent_jobs (status) where status in ('queued','in_progress');

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_teammates(id) on delete cascade,
  job_id uuid references public.agent_jobs(id) on delete set null,
  role text not null check (role in ('josh','agent','system')),
  kind text not null default 'chat' check (kind in ('chat','action','result')),
  body text not null,
  created_at timestamptz not null default now()
);
create index agent_messages_agent_created_idx on public.agent_messages (agent_id, created_at desc);

-- /team pattern: authenticated-only RLS (single-operator model).
alter table public.agent_teammates enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_messages enable row level security;
create policy "authenticated read teammates" on public.agent_teammates
  for select to authenticated using (true);
create policy "authenticated write teammates" on public.agent_teammates
  for update to authenticated using (true) with check (true);
create policy "authenticated all jobs" on public.agent_jobs
  for all to authenticated using (true) with check (true);
create policy "authenticated all messages" on public.agent_messages
  for all to authenticated using (true) with check (true);

-- Live chat updates on the members page.
alter publication supabase_realtime add table public.agent_messages;
alter publication supabase_realtime add table public.agent_jobs;
alter publication supabase_realtime add table public.agent_teammates;
