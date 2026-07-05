-- Review↔smartify loop: allow item_type='smartify-context' on waiting_on_josh.
-- A card that needs smartifying is sent to the review board (this type) so Josh
-- can add context; on resolve, the context flows back to the SMART board's
-- Needs SMART bucket. Idempotent (drop-if-exists) so it re-runs cleanly.
alter table public.waiting_on_josh drop constraint if exists waiting_on_josh_item_type_check;
alter table public.waiting_on_josh add constraint waiting_on_josh_item_type_check
  check (item_type = any (array[
    'general','sidecar_classification','brand_voice','visual_review',
    'decision','choice','outreach','content','smartify-context'
  ]));
