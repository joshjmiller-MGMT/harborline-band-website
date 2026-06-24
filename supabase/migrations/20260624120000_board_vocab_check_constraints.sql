-- Lock the SmartTaskWidget board vocab at the DB layer so manual writes can't
-- reintroduce invalid board_venture / board_bucket (the "re-normalization
-- treadmill" — see fix-smartify-vocab-at-source for the pipeline-side fix).
--
-- Canonical sets mirror src/components/board/smartTaskBuckets.ts:
--   board_venture ∈ {Harborline, Economy, JMJ, Personal, BSE, Brand Studio}
--   board_bucket  ∈ {Needs SMART, Pending approval, Active, Done}  (a kanban column)
-- NULL is allowed for both.

-- 1) Idempotent normalization of any non-canonical existing values, so the
--    CHECK constraints below can be added without violation. (Legion already
--    ran this against prod 2026-06-24; kept here for repeatability on branches.)
update public.smart_task_enrichments set board_venture = case
  when lower(board_venture) = 'harborline'                       then 'Harborline'
  when lower(board_venture) in ('economy','the economy','econ')  then 'Economy'
  when lower(board_venture) in ('jmj','josh miller jazz')        then 'JMJ'
  when lower(board_venture) = 'bse'                              then 'BSE'
  when lower(board_venture) = 'brand studio'                     then 'Brand Studio'
  when lower(board_venture) = 'production'                       then 'BSE'      -- audio/studio production = the production company
  else 'Personal'                                                                -- incl. tech/ai + any unknown
end
where board_venture is not null
  and board_venture not in ('Harborline','Economy','JMJ','Personal','BSE','Brand Studio');

-- List-name leftovers in board_bucket (Web & Tech, BSE, econ, misc, …) → the
-- review column. They carry SMART fields, so they're awaiting Josh, not unSMARTed.
update public.smart_task_enrichments set board_bucket = 'Pending approval'
where board_bucket is not null
  and board_bucket not in ('Needs SMART','Pending approval','Active','Done');

-- 2) Lock it.
alter table public.smart_task_enrichments
  drop constraint if exists smart_task_enrichments_board_venture_valid;
alter table public.smart_task_enrichments
  add constraint smart_task_enrichments_board_venture_valid
  check (board_venture is null or board_venture in
    ('Harborline','Economy','JMJ','Personal','BSE','Brand Studio'));

alter table public.smart_task_enrichments
  drop constraint if exists smart_task_enrichments_board_bucket_valid;
alter table public.smart_task_enrichments
  add constraint smart_task_enrichments_board_bucket_valid
  check (board_bucket is null or board_bucket in
    ('Needs SMART','Pending approval','Active','Done'));
