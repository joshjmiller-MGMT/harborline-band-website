-- P308 F1 — Restrict anon SELECT on google_calendar_tokens to the health
-- columns the dashboard widgets actually need. Originally the table shipped
-- with fully permissive RLS (`USING (true)` for every operation), so any
-- holder of the public Supabase anon JWT could read live Google OAuth
-- access_tokens and refresh_tokens directly via PostgREST.
--
-- The RLS policies stay open at the row level — the frontend health UI
-- needs to enumerate accounts. Column-level grants gate the secret columns
-- separately. anon/authenticated keep SELECT on the health columns; the
-- secret columns become service-role-only.
--
-- Write-side gaps (anon INSERT/UPDATE/DELETE policies still in place) stay
-- as-is in this migration because the disconnect-account UI in
-- UnifiedCalendarWidget executes the DELETE directly with the anon JWT.
-- Those close when P316 (operator-JWT auth gate) moves disconnect to an
-- authenticated edge function.

REVOKE SELECT ON public.google_calendar_tokens FROM anon, authenticated;

GRANT SELECT (
  id,
  account_email,
  needs_reconnect,
  last_refresh_at,
  last_refresh_error,
  gmail_scope_granted,
  created_at,
  updated_at
) ON public.google_calendar_tokens TO anon, authenticated;
