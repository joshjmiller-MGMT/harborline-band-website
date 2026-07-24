-- Unified People roster (Josh 7/24, applied to prod as unified_people_roster).
-- One row per human Josh works with, holding one or more CAPACITIES
-- (player / crew / managed-artist), linked to their contacts row. Seeded from
-- brand_collaborators (crew) + band_members (players) + the 7/19 editors +
-- Christopher Law. band_members stays for face-recognition; people.band_member_id
-- joins them. Full eval: people-management-architecture-eval-2026-07.md.

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacities text[] not null default '{}',
  instruments text[] default '{}',
  roles text[] default '{}',
  ventures text[] default '{}',
  tier int,
  skill_level text,
  engagement_status text not null default 'active',
  contact_id uuid references contacts(id) on delete set null,
  contact_email text,
  contact_phone text,
  instagram_handle text,
  bio_short text,
  reference_image_path text,
  headshot_url text,
  rate_note text,
  found_via text,
  notes text,
  active boolean not null default true,
  band_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table people enable row level security;
create policy people_operator_all on people for all to authenticated using (true) with check (true);

insert into people (name, capacities, roles, ventures, skill_level, engagement_status, contact_email, contact_phone, notes, found_via, rate_note)
select name, array['crew'], roles, ventures, skill_level, engagement_status, contact_email, contact_phone, notes, found_via, rate_note
from brand_collaborators;

insert into people (name, capacities, instruments, ventures, tier, engagement_status, bio_short, reference_image_path, instagram_handle, active, band_member_id)
select name, array['player'],
  array(select trim(x) from unnest(string_to_array(lower(role), '/')) x where trim(x) <> ''),
  case when name = 'Ian Hoke' then array['economy','harborline'] else array['harborline','economy','jmj'] end,
  tier, 'active', bio_short, reference_image_path, instagram_handle, active, id
from band_members;

insert into people (name, capacities, roles, ventures, engagement_status, notes) values
 ('Gabe Hoff', array['crew'], array['video editor','a2','assistant','socials'], array['harborline','economy'], 'active', 'Multifaceted crew — editor + A2 + assists + socials. Named in the 7/19 editors roster. Last name to confirm with Josh.'),
 ('Nick Lindenstruth', array['crew'], array['socials','second shooter','video editor'], array['harborline','economy'], 'active', 'Socials, second shooter, editor (7/19 roster). Distinct from "Nick" the Harborline publisher — confirm identity with Josh.');

insert into people (name, capacities, instruments, ventures, engagement_status, notes)
values ('Christopher Law', array['player'], array['bass'], '{}', 'active', 'Josh flagged 7/24 as BOTH player + crew — crew capacity TBD. Bassist (JJMM roster).');

update people p set contact_id = c.id
from contacts c
where lower(trim(p.name)) = lower(trim(c.name)) and not (coalesce(c.tags,'{}') @> '{task-not-contact}');
