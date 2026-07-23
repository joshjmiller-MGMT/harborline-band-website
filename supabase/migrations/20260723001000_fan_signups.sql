-- fan_signups — text/email capture on the public smart-link landers
-- (Josh 2026-07-22, vibe.to reference: "give them a way to sign up with text
-- or email… have a page that their submitted contacts go to that connects
-- with our current contacts page").
--
-- Public lander inserts directly (RLS: INSERT-only for anon+authenticated,
-- no SELECT — fans can never read the list; the smart_link_events 7/21 RLS
-- bug taught us to grant BOTH roles or logged-in Josh gets rejected).
-- An AFTER INSERT trigger upserts the person into contacts (source
-- 'fan-signup', tagged 'fan') so the central hub sees them — but the JJMM
-- sheet push EXCLUDES 'fan' rows: the sheet is Josh's personal network,
-- fan audiences belong to the owned-list lane.

create table if not exists fan_signups (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  contact_type text not null check (contact_type in ('phone','email')),
  contact_value text not null,
  contact_norm text not null,
  consent boolean not null default true,
  source text not null default 'smart-link',
  contact_id uuid,
  created_at timestamptz not null default now(),
  unique (slug, contact_norm)
);

alter table fan_signups enable row level security;

create policy fan_signups_public_insert on fan_signups
  for insert to anon, authenticated
  with check (
    char_length(contact_value) between 5 and 120
    and char_length(slug) between 1 and 80
  );

-- Operator reads via authenticated role (single-operator design class).
create policy fan_signups_operator_read on fan_signups
  for select to authenticated using (true);

-- Fan → contacts auto-flow. One contacts row per human (matched on the
-- normalized value), no matter how many releases they sign up for.
create or replace function public.fan_signup_to_contact()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  if new.contact_type = 'email' then
    select id into v_contact_id from contacts where lower(email) = new.contact_norm limit 1;
  else
    select id into v_contact_id from contacts
      where regexp_replace(coalesce(phone,''), '\D', '', 'g') = new.contact_norm limit 1;
  end if;

  if v_contact_id is null then
    insert into contacts (name, email, phone, source, tags, notes, sheet_synced)
    values (
      new.contact_value,
      case when new.contact_type = 'email' then new.contact_value end,
      case when new.contact_type = 'phone' then new.contact_value end,
      'fan-signup',
      array['fan', 'fan:' || new.slug],
      'Signed up on gethip smart link: ' || new.slug,
      true  -- pre-mark synced: fans are deliberately NOT pushed to the JJMM sheet
    ) returning id into v_contact_id;
  else
    update contacts set
      tags = (select array_agg(distinct t) from unnest(coalesce(tags,'{}') || array['fan', 'fan:' || new.slug]) u(t)),
      updated_at = now()
      where id = v_contact_id;
  end if;

  new.contact_id := v_contact_id;
  return new;
end;
$$;

drop trigger if exists trg_fan_signup_to_contact on fan_signups;
create trigger trg_fan_signup_to_contact
  before insert on fan_signups
  for each row execute function public.fan_signup_to_contact();
