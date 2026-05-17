-- P311 — Bucket overlay for the Booking-Agent Google Sheet.
--
-- The lead pipeline source-of-truth lives in Josh's Google Sheet (read by
-- `booking-agent-rows` via the CSV export endpoint — read-only path). Scrum
-- buckets ("Reach Out" / "Awaiting Reply" / ... / "Done") aren't a column on
-- the sheet, so we store them in Supabase keyed by (sheet_id, row_index). The
-- edge fn merges this overlay onto each row before returning it.
--
-- Post-P319 hygiene: RLS-on, no anon policies. Writes go through the
-- `update-booking-bucket` edge fn (service-role bypass, requireOperator-gated).
-- Reads come from `booking-agent-rows` (also service-role).

CREATE TABLE public.booking_pipeline_buckets (
  sheet_id   text NOT NULL,
  row_index  integer NOT NULL,
  bucket     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, row_index)
);

CREATE INDEX idx_booking_pipeline_buckets_sheet
  ON public.booking_pipeline_buckets (sheet_id);

ALTER TABLE public.booking_pipeline_buckets ENABLE ROW LEVEL SECURITY;
