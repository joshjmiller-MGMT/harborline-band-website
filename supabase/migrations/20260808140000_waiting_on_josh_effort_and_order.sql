-- Josh 2026-08-08: "update the today to do list in the site with everything I
-- need to do for everything."
--
-- The Today panel already read waiting_on_josh, but it capped at 6 rows and
-- sorted by priority + age only, so it never showed the whole list and could
-- not tell a two-minute click from a forty-five-minute grant application.
-- est_minutes + do_order let the site rank by leverage-per-minute.
--
-- Applied via the Management API the same session; transcribed here per the
-- same-session write-back convention. Seed values for the 24 open cards are in
-- that migration.

alter table public.waiting_on_josh
  add column if not exists est_minutes int,
  add column if not exists do_order int;

comment on column public.waiting_on_josh.est_minutes is
  'Honest estimate of Josh''s time in minutes. Drives the "quick wins" grouping on the Today panel.';
comment on column public.waiting_on_josh.do_order is
  'Suggested running order across the whole open board. Lower runs first.';
