-- RBAC step 1 (spec: wiki/harborline/rbac-spec-2026-08.md). Roles table only —
-- no enforcement yet, so this is behaviour-neutral and safe to ship alone.
create table if not exists team_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member'
    check (role in ('owner','manager','member','collaborator')),
  surfaces text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table team_profiles enable row level security;

-- Everyone signed in may read the roster (the UI needs their own role); only
-- owners may write. SECURITY: the write policy is intentionally owner-only so
-- nobody can promote themselves.
drop policy if exists team_profiles_read on team_profiles;
create policy team_profiles_read on team_profiles for select to authenticated using (true);
drop policy if exists team_profiles_owner_write on team_profiles;
create policy team_profiles_owner_write on team_profiles for all to authenticated
  using (exists (select 1 from team_profiles p where p.user_id = auth.uid() and p.role = 'owner'))
  with check (exists (select 1 from team_profiles p where p.user_id = auth.uid() and p.role = 'owner'));

-- Single source of truth for both RLS and edge fns, replacing the separate
-- OPERATOR_USER_IDS env allowlist in a later step.
create or replace function auth_role() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from team_profiles where user_id = auth.uid()), 'member')
$$;
create or replace function is_operator() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from team_profiles where user_id = auth.uid()), 'member') in ('owner','manager')
$$;

-- Seed: Josh is owner. Any future auth user defaults to 'member' via the column default.
insert into team_profiles (user_id, display_name, role)
values ('38b8bd40-9b24-45bb-b9bc-a0d5540fa99b', 'Josh Miller', 'owner')
on conflict (user_id) do update set role = 'owner', updated_at = now();

select user_id::text, display_name, role from team_profiles;
