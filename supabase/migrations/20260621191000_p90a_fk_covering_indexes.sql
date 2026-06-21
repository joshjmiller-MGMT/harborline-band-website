-- p90a — performance hardening: add covering indexes for the 6 unindexed foreign
-- keys flagged by the Supabase performance advisor (`unindexed_foreign_keys`).
--
-- An FK without a covering index makes joins + cascade/restrict checks on the
-- referenced parent do sequential scans on the child. Adding a btree index on the
-- FK column is the standard, safe, behavior-preserving fix. All target tables are
-- small, so a plain (non-CONCURRENT) CREATE INDEX inside the migration txn is fine.
--
-- Scope note: this migration ONLY adds the 6 FK indexes. The ~40 `unused_index`
-- findings are NOT actioned here — on a young, low-traffic DB (created 2026-04-30)
-- "unused" usually means the feature's query pattern just hasn't run yet (seasonal
-- admin queries, GIN search filters, etc.), so dropping them is premature. They are
-- triaged + deferred — see wiki/harborline/co-manager/02-sources/2026-06-21-performance-advisors-sweep.md.

create index if not exists idx_brand_decisions_superseded_by
  on public.brand_decisions (superseded_by);

create index if not exists idx_instrument_event_classifications_matched_rule_id
  on public.instrument_event_classifications (matched_rule_id);

create index if not exists idx_practice_sessions_preset_id
  on public.practice_sessions (preset_id);

create index if not exists idx_setlist_builds_created_by
  on public.setlist_builds (created_by);

create index if not exists idx_social_posts_source_id
  on public.social_posts (source_id);

create index if not exists idx_trello_card_routes_route_id
  on public.trello_card_routes (route_id);
