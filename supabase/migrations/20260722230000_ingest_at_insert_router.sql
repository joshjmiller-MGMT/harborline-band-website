-- At-ingest router — content_ingest_log rows execute their route the moment
-- they land, so the classified-but-never-routed backlog (846 items, root-caused
-- 7/20, flood-drained 7/21) can never rebuild. DB trigger = client-agnostic:
-- works whether the Mac pipeline inserts classified rows in one shot or
-- classifies via a second UPDATE pass.
--
-- Josh's rules baked in (2026-07-22):
--  1. Artist/band-source content defaults to REFERENCE (tagged, overridable):
--     discovery-flavored actionables with no deadline/urgency downgrade to
--     reference instead of flooding boards.
--  2. Maximize machine tags (src:/via:/v: + teaching/artist-src) so items are
--     bulk-processable later.
--  3. Feed philosophy: feed = artist/track discovery ONLY. Teaching/how-to →
--     SMART "Needs SMART". Reference without a discovery link stays in the
--     ingest log (routed_ref='reference:log') — the feed is not a dump.
--  4. Flow doctrine: review board gets ONLY urgent/deadline items; everything
--     else actionable → SMART board (river takes it from there).
--
-- Destinations mirror the 7/21 flood's shapes:
--   review     → waiting_on_josh row               routed_ref=<uuid>
--   actionable → smart_task_enrichments            trello_card_id='ingest-action:<id>' routed_ref='smart:<uuid>'
--   brain_note → smart_task_enrichments (tagged)   trello_card_id='ingest-brain:<id>'
--   teaching   → smart_task_enrichments            trello_card_id='ingest-learn:<id>'
--   poc_followup → outreach_targets                routed_ref='outreach:<id>'
--   discovery  → feed_items (listen/watch)         routed_ref='feed:<uuid>'
--   reference  → no artifact                       routed_ref='reference:log'

create or replace function public.route_ingest_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text;
  v_teaching boolean;
  v_artist_src boolean;
  v_urgent boolean;
  v_route text;
  v_board_venture text;
  v_new_id uuid;
  v_out_id bigint;
  v_title text;
begin
  -- Only act on classified, not-yet-routed rows.
  if new.route is null or new.route = '' or new.routed_ref is not null or new.status = 'routed' then
    return new;
  end if;

  v_text := lower(coalesce(new.application,'') || ' ' || coalesce(new.purpose,'') || ' ' ||
                  coalesce(new.summary,'') || ' ' || coalesce(array_to_string(new.tags,' '),''));
  v_teaching  := v_text ~ 'teach|tutorial|lesson|technique|how[- ]to|workflow|exercis|masterclass|practice tip';
  v_artist_src := (not v_teaching) and (
      v_text ~ 'discover|inspiration|listen|new artist|new track|new album|music discovery'
      or new.tags && array['artist','band','artist-account','music-discovery']);
  v_urgent := new.time_sensitivity = 'urgent'
      or (new.deadline is not null and new.deadline <= current_date + 14);

  v_title := coalesce(nullif(left(new.summary, 140), ''), nullif(left(new.caption, 140), ''), 'Ingested item');

  v_board_venture := case
    when new.venture ilike '%BSE%' or new.venture ilike '%Baltimore Sound%' then 'BSE'
    when new.venture ilike '%harborline%' then 'Harborline'
    when new.venture ilike '%JMJ%' or new.venture ilike '%jazz%' then 'JMJ'
    when new.venture ilike '%economy%' then 'Economy'
    when new.venture ilike '%solo%' or new.venture ilike '%operator%' or new.venture ilike '%personal%' then 'Personal'
    else null
  end;

  -- Machine tags for bulk processing (rule 2). Dedup via set union.
  new.tags := (
    select array_agg(distinct t) from unnest(
      coalesce(new.tags, '{}') ||
      array['src:' || coalesce(nullif(new.source_account,''),'unknown'),
            'via:' || coalesce(nullif(new.platform,''),'unknown')] ||
      case when v_board_venture is not null then array['v:' || v_board_venture] else '{}'::text[] end ||
      case when v_teaching then array['teaching'] else '{}'::text[] end ||
      case when v_artist_src then array['artist-src'] else '{}'::text[] end
    ) as u(t)
  );

  -- Rule 1: artist-source actionables with no urgency/deadline → reference default.
  v_route := new.route;
  if v_artist_src and v_route in ('trello_card','waiting_on_josh','poc_followup')
     and not v_urgent and new.deadline is null then
    v_route := 'passive_ref';
    new.tags := new.tags || array['auto-ref-default'];
  end if;

  if v_route = 'waiting_on_josh' and v_urgent then
    insert into waiting_on_josh (title, detail, item_type, priority, source_session, source_ref)
    values (v_title,
            coalesce(new.action, new.summary) ||
              case when new.url is not null then E'\n\nSource: ' || new.url else '' end ||
              case when new.deadline is not null then E'\nDeadline: ' || new.deadline else '' end,
            'general', 'high', 'ingest-router', 'ingest:' || new.id)
    returning id into v_new_id;
    new.routed_ref := v_new_id::text;

  elsif v_route in ('waiting_on_josh','trello_card','brain_note') or (v_route = 'passive_ref' and v_teaching) then
    insert into smart_task_enrichments (trello_card_id, raw_input, board_bucket, board_venture, due_date)
    values (
      case
        when v_route = 'brain_note' then 'ingest-brain:' || new.id
        when v_route = 'passive_ref' then 'ingest-learn:' || new.id
        else 'ingest-action:' || new.id
      end,
      v_title || case when new.action is not null and new.action <> '' then E'\n' || new.action else '' end
              || case when new.url is not null then E'\n' || new.url else '' end,
      'Needs SMART', v_board_venture, new.deadline)
    returning id into v_new_id;
    new.routed_ref := 'smart:' || v_new_id::text;
    if v_route = 'brain_note' then new.tags := new.tags || array['brain-note']; end if;

  elsif v_route = 'poc_followup' then
    insert into outreach_targets (target, type, act, why, next_action, status, source, sort)
    values (v_title, 'poc', coalesce(v_board_venture,'Harborline'),
            coalesce(new.summary,''), coalesce(new.action,'follow up'), 'new', 'ingest',
            9999)
    returning id into v_out_id;
    new.routed_ref := 'outreach:' || v_out_id::text;

  elsif v_artist_src and new.url is not null then
    insert into feed_items (kind, title, url, link, blurb, venture, source, consumed)
    values (case when v_text ~ 'listen|track|album|song|record' then 'listen' else 'watch' end,
            v_title, new.url, new.url, left(coalesce(new.summary,''), 300),
            v_board_venture, 'ingest', false)
    returning id into v_new_id;
    new.routed_ref := 'feed:' || v_new_id::text;

  else
    -- Reference without a discovery artifact: lives in the ingest log itself.
    new.routed_ref := 'reference:log';
  end if;

  new.status := 'routed';
  new.processed_at := coalesce(new.processed_at, now());
  return new;
end;
$$;

drop trigger if exists trg_route_ingest_at_insert on content_ingest_log;
create trigger trg_route_ingest_at_insert
  before insert or update of route
  on content_ingest_log
  for each row
  execute function public.route_ingest_item();
