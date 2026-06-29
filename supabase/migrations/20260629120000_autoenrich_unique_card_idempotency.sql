-- trello-smart-superhighway — idempotency guard for the auto-enrich pass.
--
-- The recurring smartify pass (edge fn `smart-task-autoenrich`) inserts one
-- smart_task_enrichments row per Trello card. To make overlapping cron ticks
-- safe (re-runnable + idempotent — a hard requirement of the lane), enforce one
-- enrichment per card at the DB layer with a PARTIAL unique index on
-- trello_card_id (partial because legacy manual rows may carry a NULL
-- trello_card_id, and multiple NULLs must remain allowed).
--
-- The edge fn already pre-filters cards that have an enrichment; this index is
-- the race backstop — a concurrent insert that loses the race raises 23505,
-- which the fn catches and treats as "already enriched" (skip, no error).
--
-- Verified before authoring: 0 duplicate non-NULL trello_card_id rows exist
-- (230 distinct cards / 230 rows), so this applies clean with no dedup needed.

create unique index if not exists uq_smart_task_enrichments_trello_card_id
  on public.smart_task_enrichments (trello_card_id)
  where trello_card_id is not null;
