-- P313 — Social workflow tracker + content queue.
--
-- Tracker layer only. Posting stays manual (Josh-or-Des executes). Q6 locked
-- to read-only `/team/social-handoff/<week>` URL pattern (HMAC week-token via
-- `social-handoff-read` edge fn). The operator surface at `/team/social`
-- writes to these tables via `social-queue-mutate` (requireOperator-gated).
--
-- Post-P319 hygiene: RLS-on, no anon policies. All reads + writes go through
-- the two edge fns (both run with service-role).

CREATE TABLE public.social_content_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_paths   text[] NOT NULL DEFAULT '{}',
  caption       text NOT NULL DEFAULT '',
  scheduled_for date,
  slot          text CHECK (slot IN (
                  'tue_post','thu_post',
                  'tue_stories','wed_stories','thu_stories','fri_stories'
                )),
  accounts      text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','ready','published','skipped')),
  assigned_to   text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_content_queue_scheduled
  ON public.social_content_queue (scheduled_for);

CREATE INDEX idx_social_content_queue_status
  ON public.social_content_queue (status);

ALTER TABLE public.social_content_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.social_workflow_status (
  date              date PRIMARY KEY,
  mon_prep_done     boolean NOT NULL DEFAULT false,
  tue_post_done     boolean NOT NULL DEFAULT false,
  tue_stories_done  boolean NOT NULL DEFAULT false,
  wed_stories_done  boolean NOT NULL DEFAULT false,
  thu_post_done     boolean NOT NULL DEFAULT false,
  thu_stories_done  boolean NOT NULL DEFAULT false,
  fri_stories_done  boolean NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_workflow_status ENABLE ROW LEVEL SECURITY;
