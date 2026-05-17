-- P305 — TTL cache for the gmail-needs-action edge fn.
--
-- Today every dashboard load hits the Gmail API ~100 times (one list call
-- per connected account + one metadata GET per message). Well under quota
-- but a needless round-trip pile-up. This table mirrors availability_cache's
-- shape (explicit expires_at + RLS-on) so the read/write path stays familiar.
--
-- Post-P319: no anon policies. The edge fn reads/writes via service_role,
-- which bypasses RLS. Frontend never touches this table directly.

CREATE TABLE public.gmail_needs_action_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_email text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_gmail_needs_action_cache_email_fetched
  ON public.gmail_needs_action_cache (account_email, fetched_at DESC);
CREATE INDEX idx_gmail_needs_action_cache_expires
  ON public.gmail_needs_action_cache (expires_at);

ALTER TABLE public.gmail_needs_action_cache ENABLE ROW LEVEL SECURITY;
