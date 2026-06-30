-- review-board-multiple-choice — allow item_type='choice'.
--
-- The multiple-choice escalation columns (options jsonb + assumed_default text)
-- already landed on waiting_on_josh, but the item_type CHECK constraint (P347)
-- still only permits general / sidecar_classification / brand_voice /
-- visual_review / decision. A branch escalating a one-tap CHOICE decision needs
-- item_type='choice', so extend the CHECK to include it. Without this, any
-- insert with item_type='choice' fails and the new Choice tab/badge in
-- /team/review always reads 0.
--
-- Drop + re-add the named constraint (the P347 ADD COLUMN created it inline as
-- waiting_on_josh_item_type_check). IF EXISTS keeps this idempotent.

ALTER TABLE public.waiting_on_josh
  DROP CONSTRAINT IF EXISTS waiting_on_josh_item_type_check;

ALTER TABLE public.waiting_on_josh
  ADD CONSTRAINT waiting_on_josh_item_type_check
  CHECK (item_type IN (
    'general',
    'sidecar_classification',
    'brand_voice',
    'visual_review',
    'decision',
    'choice'
  ));
