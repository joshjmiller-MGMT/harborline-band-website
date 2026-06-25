-- Board vocab integrity for smart_task_enrichments.
-- Makes invalid board_bucket / board_venture values impossible at the DB layer.
--
-- Why: the SMART-task board (/team/smart-tasks, useSmartTaskBoardData) groups rows by
-- board_bucket (a board COLUMN) and board_venture (a venture). The canonical vocab lives in
-- src/components/board/smartTaskBuckets.ts:
--   PERSISTABLE_SMART_BUCKETS = Needs SMART | Pending approval | Active | Done
--     (the column "Trello inbox" is populated only by trello-poll output, never persisted here)
--   SMART_VENTURES            = Harborline | Economy | JMJ | Personal | BSE | Brand Studio
-- The smart-task-rewrite pipeline already emits valid vocab, but MANUAL writes to this table
-- (e.g. the per-bucket Trello backfills) had reintroduced non-column values like 'econ' / 'urgent'
-- into board_bucket, so those rows fell out of every board column and went invisible. These CHECKs
-- prevent that class of bug recurring. NULL is allowed (a row may be mid-pipeline / venture unknown).
--
-- Verified before authoring: 0 existing rows violate either constraint, so this applies cleanly.

alter table public.smart_task_enrichments
  add constraint smart_task_enrichments_board_bucket_vocab
  check (
    board_bucket is null
    or board_bucket in ('Needs SMART', 'Pending approval', 'Active', 'Done')
  );

alter table public.smart_task_enrichments
  add constraint smart_task_enrichments_board_venture_vocab
  check (
    board_venture is null
    or board_venture in ('Harborline', 'Economy', 'JMJ', 'Personal', 'BSE', 'Brand Studio')
  );
