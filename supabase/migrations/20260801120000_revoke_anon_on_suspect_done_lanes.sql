-- Security fix 2026-08-01: v_suspect_done_lanes was readable by anon.
--
-- The view is owned by `postgres` and was created without
-- `security_invoker=on`, so it ran with the OWNER's privileges and therefore
-- BYPASSED row level security on the underlying work_claims table. Net effect:
-- work_claims correctly returned 0 rows to the public anon key, but selecting
-- the view with that same public key returned real internal rows -- work_key,
-- claimed_by, notes_snippet, released_at.
--
-- The anon key is shipped in the site's JS bundle, so this was readable by
-- anyone who looked. This is the classic Supabase "security definer view"
-- exposure: RLS on the table is necessary but NOT sufficient once a
-- postgres-owned view sits in front of it.
--
-- This view is an internal done-ledger audit surface (see the 7/22 truth
-- audit). It is queried with the service role and is referenced nowhere in
-- application code, so removing anon/authenticated access breaks nothing.
--
-- Applied to production directly on 2026-08-01 and recorded here so a view
-- rebuild or a fresh environment cannot silently reintroduce the exposure.
-- Reversible with a single GRANT if this ever needs to front a /team page.

revoke select on public.v_suspect_done_lanes from anon, authenticated;

-- Belt and braces: make the view honor the CALLER's RLS rather than the
-- owner's. With security_invoker=on the view can no longer out-privilege
-- work_claims even if someone re-grants SELECT on it later.
alter view public.v_suspect_done_lanes set (security_invoker = on);
