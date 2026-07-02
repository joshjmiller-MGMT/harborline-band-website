-- Add 'outreach' + 'content' item types so IG-digest activation seeds get their own
-- tabs ("a place") on /team/review, trackable + completable via the standard resolve flow.
alter table public.waiting_on_josh drop constraint if exists waiting_on_josh_item_type_check;
alter table public.waiting_on_josh add constraint waiting_on_josh_item_type_check
  check (item_type = any (array[
    'general','sidecar_classification','brand_voice','visual_review','decision','choice','outreach','content'
  ]));
