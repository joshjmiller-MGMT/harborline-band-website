-- p92b — security hardening: close anonymous access on operator data.
--
-- Context: 75 `rls_policy_always_true` advisor findings. These policies are role
-- `public` (= anon + authenticated) with `USING (true)` / no INSERT check — i.e.
-- ANYONE holding the publishable key (it ships in the client bundle) can read AND
-- write this data without logging in. Josh confirmed (2026-06-22) every /team login
-- is a trusted operator, so the fix is to restrict these policies to the
-- `authenticated` role (closes anon; logged-in magic-link users unaffected; edge
-- functions use the service role and bypass RLS entirely).
--
-- Scope decisions:
--  • 24 operator-only tables → ALL their public/anon policies → authenticated.
--  • chart_index + visual_assets → close anon WRITES only; their public SELECT is a
--    deliberate design choice (kept, pending Josh's call on whether to also close reads).
--  • band_members → untouched; its only anon policy is the intentional active-roster
--    public read (`active = true AND tier IS NOT NULL`).
--
-- Uses ALTER POLICY (role change only) — USING/CHECK clauses are preserved, so
-- behavior for authenticated users is identical. Idempotent (re-running re-sets role).

do $$
declare
  r record;
  operator_tables text[] := array[
    'availability_cache','booking_agent_config','brand_collaborators','brand_decisions',
    'brand_releases','canonical_events','instrument_classifier_rules',
    'instrument_event_classifications','posting_times_cache','posting_times_sources',
    'practice_items','practice_preset_segments','practice_presets','practice_session_segments',
    'practice_sessions','practice_songs','rehearsal_responses','run_of_show',
    'smart_task_enrichments','social_brands','social_posts','social_sources',
    'waiting_on_josh','work_claims'
  ];
begin
  -- 1) Operator-only tables: restrict every anon/public policy to authenticated.
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(operator_tables)
      and ('public' = any(roles) or 'anon' = any(roles))
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
  end loop;

  -- 2) chart_index + visual_assets: close anon WRITES (INSERT/UPDATE/DELETE) only;
  --    keep their deliberate public SELECT.
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('chart_index','visual_assets')
      and cmd <> 'SELECT'
      and ('public' = any(roles) or 'anon' = any(roles))
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
  end loop;
end $$;
