-- Broadcast history (Josh 7/24, applied to prod as fan_broadcasts). One row
-- per "message my list" send from /team/fans → fan-broadcast edge fn.
create table if not exists fan_broadcasts (
  id uuid primary key default gen_random_uuid(),
  channel text not null,           -- email | sms
  segment text not null,           -- 'all' or a release slug (fan:<slug>)
  subject text,                    -- email only
  body text not null,
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  status text not null default 'sent',
  created_by text,
  created_at timestamptz not null default now()
);
alter table fan_broadcasts enable row level security;
create policy fan_broadcasts_operator_all on fan_broadcasts for all to authenticated using (true) with check (true);
