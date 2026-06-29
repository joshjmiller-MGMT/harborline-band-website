-- p93 — maintenance-security pass (2026-06-28). Deferred p92 items.
-- Author: legion-2026-06-21-loop. JARSH applies.
--
-- ============================================================================
-- PART 1 — Revoke broad EXECUTE on SECURITY DEFINER functions (advisor:
--   anon_/authenticated_security_definer_function_executable, 16 findings).
--
-- These 8 functions are SECURITY DEFINER (run as owner=postgres) and currently
-- executable by PUBLIC (the default grant), i.e. by anon + authenticated via the
-- publishable key. Verified callers:
--   - 6 are pg_cron jobs running as `postgres` (owner → unaffected by these revokes):
--       trigger_availability_prefetch, refresh_djep_calendar_events_cache,
--       refresh_djep_past_events_cache, trigger_integration_health_check,
--       trigger_posting_times_refresh, trigger_trello_route
--   - trigger_trello_route + trigger_trello_mark_done are ALSO called by the
--     `trello-route-cards` edge fn (service_role) → re-grant to service_role.
--   - chart_index_genres: not referenced on main (likely the unmerged chart-browser
--     branch, a /team read) → keep `authenticated`, drop anon.
--   - NONE are called from frontend code (verified: present only in generated
--     types.ts), so dropping anon/authenticated EXECUTE is behavior-preserving.
--
-- Pattern: revoke from public/anon/authenticated, then grant to service_role so
-- edge-fn (service_role) + cron (postgres owner) keep working.

revoke execute on function public.refresh_djep_calendar_events_cache()  from public, anon, authenticated;
grant  execute on function public.refresh_djep_calendar_events_cache()  to service_role;

revoke execute on function public.refresh_djep_past_events_cache()      from public, anon, authenticated;
grant  execute on function public.refresh_djep_past_events_cache()      to service_role;

revoke execute on function public.trigger_availability_prefetch()       from public, anon, authenticated;
grant  execute on function public.trigger_availability_prefetch()       to service_role;

revoke execute on function public.trigger_integration_health_check()    from public, anon, authenticated;
grant  execute on function public.trigger_integration_health_check()    to service_role;

revoke execute on function public.trigger_posting_times_refresh()       from public, anon, authenticated;
grant  execute on function public.trigger_posting_times_refresh()       to service_role;

revoke execute on function public.trigger_trello_route()                from public, anon, authenticated;
grant  execute on function public.trigger_trello_route()                to service_role;

revoke execute on function public.trigger_trello_mark_done(p_card_id text) from public, anon, authenticated;
grant  execute on function public.trigger_trello_mark_done(p_card_id text) to service_role;

-- chart_index_genres: keep authenticated (potential /team chart-browser read), drop anon.
revoke execute on function public.chart_index_genres() from public, anon;
grant  execute on function public.chart_index_genres() to service_role, authenticated;

-- ============================================================================
-- PART 2 — Storage bucket lockdown (advisor: public_bucket_allows_listing, 2;
--   PLUS an anon write hole found during the sweep).
--
-- `assets` (empty, no frontend use) + `visual-assets` (frontend uploads/removes
-- as AUTHENTICATED; gallery serves by public URL + DB rows, never lists; edge
-- fns use service_role and bypass RLS). Public-URL path serving on a public
-- bucket does NOT go through these policies, so restricting them to
-- `authenticated` is behavior-preserving for image display.
--
--   * "Public read access"  (assets SELECT, anon+authenticated) → authenticated  [stop anon listing]
--   * "visual-assets read"  (SELECT, public)                    → authenticated  [stop anon listing]
--   * "visual-assets delete"(DELETE, public)                    → authenticated  [CLOSE anon-delete hole]
--   * "visual-assets update"(UPDATE, public)                    → authenticated  [CLOSE anon-update hole]
--
-- NOTE: storage.objects is owned by supabase_storage_admin. If the migration
-- role can't ALTER these policies, apply Part 2 via the Dashboard Storage policy
-- editor (same 4 role changes). Part 1 is independent and applies regardless.

alter policy "Public read access"   on storage.objects to authenticated;
alter policy "visual-assets read"   on storage.objects to authenticated;
alter policy "visual-assets delete" on storage.objects to authenticated;
alter policy "visual-assets update" on storage.objects to authenticated;
