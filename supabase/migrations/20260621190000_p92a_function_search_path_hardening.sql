-- p92a — security hardening: pin search_path on the 9 functions flagged by the
-- Supabase security advisor (`function_search_path_mutable`).
--
-- All 9 are SECURITY INVOKER helpers (8 no-arg `*_set_updated_at`/touch triggers,
-- `cleanup_old_posting_times_sources`, and the `chart_index_build_tsv` tsvector
-- builder). Pinning to `pg_catalog, public` is behavior-preserving — these
-- reference only built-ins + public objects — and resolves the "mutable
-- search_path" warning (a function with no fixed search_path can be hijacked by
-- a caller-controlled path). No body changes, no behavior change.
--
-- Scope note: this migration ONLY addresses the 9 search_path findings. The
-- other 112 advisor findings (75 rls_policy_always_true, 18 rls_enabled_no_policy,
-- 16 security-definer EXECUTE grants, 2 public-bucket-listing, 1 auth setting) are
-- judgment-heavy / app-breaking-if-done-blindly and are deferred to a Josh-aware
-- review pass — see wiki/harborline/co-manager/02-sources/2026-06-21-security-advisors-sweep.md.

alter function public.archive_events_set_updated_at()        set search_path = pg_catalog, public;
alter function public.canonical_events_set_updated_at()      set search_path = pg_catalog, public;
alter function public.chart_index_touch_updated_at()         set search_path = pg_catalog, public;
alter function public.cleanup_old_posting_times_sources()    set search_path = pg_catalog, public;
alter function public.run_of_show_set_updated_at()           set search_path = pg_catalog, public;
alter function public.setlist_builds_set_updated_at()        set search_path = pg_catalog, public;
alter function public.tg_set_updated_at_p325a()              set search_path = pg_catalog, public;
alter function public.visual_assets_set_updated_at()         set search_path = pg_catalog, public;

alter function public.chart_index_build_tsv(
  p_title text, p_composer text, p_reference text, p_genre text,
  p_setlists text[], p_ireal_pro text[], p_tags text[], p_keywords text, p_filename text
) set search_path = pg_catalog, public;
