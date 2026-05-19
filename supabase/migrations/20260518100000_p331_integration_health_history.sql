-- P331a — integration_health_history persistent log.
-- One row per adapter per check. Latest row per integration powers the dashboard
-- widget (P331c); the full history (30-90d rolling) supports trend graphs and
-- post-incident review.
--
-- Cleanup of rows >90 days is deferred to a follow-up sub-phase; for Phase 1 the
-- table grows at ~10 rows/day so disk is not a concern.

CREATE TABLE public.integration_health_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  status text NOT NULL CHECK (status IN ('green','yellow','red')),
  detail text,
  metric_value text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ihh_integration_checked_at
  ON public.integration_health_history (integration, checked_at DESC);

CREATE INDEX idx_ihh_status_checked_at
  ON public.integration_health_history (status, checked_at DESC)
  WHERE status != 'green';

ALTER TABLE public.integration_health_history ENABLE ROW LEVEL SECURITY;
-- No anon policies. Service-role and authenticated operator JWT (via edge fn) only.
