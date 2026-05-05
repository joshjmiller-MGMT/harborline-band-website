-- Persist Google connection health so the widget can show stale-connection state
-- proactively, without requiring the user to run an availability check.

ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS needs_reconnect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_refresh_error text,
  ADD COLUMN IF NOT EXISTS gmail_scope_granted boolean NOT NULL DEFAULT false;

-- Backfill gmail_scope_granted from the existing scope string for current rows.
UPDATE public.google_calendar_tokens
  SET gmail_scope_granted = (scope LIKE '%gmail.readonly%')
  WHERE scope IS NOT NULL;
