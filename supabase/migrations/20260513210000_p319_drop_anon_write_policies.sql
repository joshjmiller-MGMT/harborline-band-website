-- P319 — drop anon INSERT/UPDATE/DELETE policies on google_calendar_tokens
-- and monday_calendar_sources. Closes the write-side gap that P308 F1 left
-- behind. All writes now route through operator-gated edge functions:
--   - google_calendar_tokens:
--       INSERT/UPDATE → google-calendar-oauth + refresh-google-token (service-role)
--       DELETE        → disconnect-google-account (operator-gated)
--   - monday_calendar_sources:
--       INSERT/UPDATE/DELETE → manage-monday-source (operator-gated)
--
-- SELECT policies are intentionally left in place — frontend health widgets
-- enumerate accounts. P308's column grants on google_calendar_tokens already
-- gate the secret columns (access_token, refresh_token, scope, expires_at).

DROP POLICY IF EXISTS "Anyone can insert google tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Anyone can update google tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Anyone can delete google tokens" ON public.google_calendar_tokens;

DROP POLICY IF EXISTS "Anyone can insert monday sources" ON public.monday_calendar_sources;
DROP POLICY IF EXISTS "Anyone can update monday sources" ON public.monday_calendar_sources;
DROP POLICY IF EXISTS "Anyone can delete monday sources" ON public.monday_calendar_sources;
