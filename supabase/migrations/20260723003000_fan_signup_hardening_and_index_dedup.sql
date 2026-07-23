-- Fine-grain sweep fixes (2026-07-22, applied to prod as
-- fan_signup_hardening_and_index_dedup):
-- 1. fan_signup_to_contact derives contact_norm SERVER-SIDE (the client value
--    was trusted before — (slug, contact_norm) uniqueness was bypassable) and
--    canonicalizes US numbers (strip leading 1 from 11-digit) so "+1 410…"
--    and "410…" collide into one contact. Phone matching applies the same
--    strip to the contacts side.
-- 2. Drop the duplicate partial unique index on smart_task_enrichments
--    (uq_smart_task_enrichments_trello_card_id stays).

create or replace function public.fan_signup_to_contact()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  -- Server-derived norm: never trust the client's contact_norm.
  if new.contact_type = 'email' then
    new.contact_norm := lower(trim(new.contact_value));
  else
    new.contact_norm := regexp_replace(new.contact_value, '\D', '', 'g');
    if length(new.contact_norm) = 11 and new.contact_norm like '1%' then
      new.contact_norm := substr(new.contact_norm, 2);
    end if;
  end if;

  if new.contact_type = 'email' then
    select id into v_contact_id from contacts where lower(email) = new.contact_norm limit 1;
  else
    select id into v_contact_id from contacts
      where case
        when length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) = 11
         and regexp_replace(coalesce(phone,''), '\D', '', 'g') like '1%'
        then substr(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 2)
        else regexp_replace(coalesce(phone,''), '\D', '', 'g')
      end = new.contact_norm
      limit 1;
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
      true
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

drop index if exists smart_task_enrichments_trello_card_id_uniq;
