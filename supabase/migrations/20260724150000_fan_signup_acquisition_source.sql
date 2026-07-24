-- Capture where each fan came from (Josh 7/24, applied to prod as
-- fan_signup_acquisition_source). A signup that remembers its source turns the
-- owned list into an asset. utm + referrer land on fan_signups; the trigger
-- stamps a src:<source> tag onto the contact (filterable in /team/fans +
-- /team/contacts) and notes the campaign.
alter table fan_signups
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists referrer text;

create or replace function public.fan_signup_to_contact()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_contact_id uuid;
  v_src_tag text;
begin
  if new.contact_type = 'email' then
    new.contact_norm := lower(trim(new.contact_value));
  else
    new.contact_norm := regexp_replace(new.contact_value, '\D', '', 'g');
    if length(new.contact_norm) = 11 and new.contact_norm like '1%' then
      new.contact_norm := substr(new.contact_norm, 2);
    end if;
  end if;

  v_src_tag := case when nullif(new.utm_source,'') is not null
                    then 'src:' || lower(new.utm_source) else null end;

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
      array['fan', 'fan:' || new.slug] || coalesce(array[v_src_tag], '{}'),
      'Signed up on gethip smart link: ' || new.slug
        || case when nullif(new.utm_source,'') is not null
                then ' (via ' || new.utm_source
                     || coalesce('/' || nullif(new.utm_medium,''), '') || ')'
                else '' end,
      true
    ) returning id into v_contact_id;
  else
    update contacts set
      tags = (select array_agg(distinct t) from unnest(
                coalesce(tags,'{}') || array['fan', 'fan:' || new.slug]
                || coalesce(array[v_src_tag], '{}')) u(t) where t is not null),
      updated_at = now()
      where id = v_contact_id;
  end if;

  new.contact_id := v_contact_id;
  return new;
end;
$$;
