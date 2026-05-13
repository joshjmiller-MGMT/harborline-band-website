-- P13: trace columns so a SMART task knows where it came from (Trello card)
-- and where it landed (Google Calendar event). Partial-unique on trello_card_id
-- prevents the same card from being SMART-ified twice if the label-add ever
-- races with the next poll.

alter table public.smart_task_enrichments
  add column if not exists trello_card_id text,
  add column if not exists trello_card_url text,
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_html_link text;

create unique index if not exists smart_task_enrichments_trello_card_id_uniq
  on public.smart_task_enrichments (trello_card_id)
  where trello_card_id is not null;
